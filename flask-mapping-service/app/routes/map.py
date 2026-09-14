"""
Map API routes — nodes, edges, routing, and the full offline-cache graph endpoint.

Guardrails enforced:
- No fake/placeholder nodes created
- Cross-floor edges require elevator/stairs/escalator node types
- Edge weights always auto-computed via Haversine
- Coordinate updates recompute all connected edge weights
- Bounding-box validation on coordinate assignment
"""

from flask import Blueprint, jsonify, request, send_from_directory
import logging
import math
import os
import uuid
from typing import Any
from werkzeug.utils import secure_filename

from app.models.map_node import get_all_nodes, create_node, get_node_by_id, update_node, delete_node
from app.models.map_edge import get_all_edges, create_edge, delete_edge
from app.models.floor_plan import (
    get_all_floor_plans, get_floor_plan_by_id,
    create_floor_plan, update_floor_plan, delete_floor_plan,
)
from app.utils.pathfinding import find_shortest_path, get_nearby_nodes, plan_full_tour
from app.utils.geo import haversine_distance, map_xy_to_gps, affine_transform_from_anchors
from app.utils.geojson import to_geojson_point, to_geojson_linestring, to_geojson_polygon
from app.utils.galleries_db import get_galleries_by_floor
from app.models.room import get_rooms_by_floor_plan, get_doorways_by_floor_plan
from app.utils.geometry import segment_crosses_any_wall, point_in_polygon
from app.models.footprint import get_footprint_by_floor_plan, save_footprint, validate_point_in_footprint
import re
from app.utils.room_routing import calculate_full_room_route, invalidate_room_route_cache

map_bp = Blueprint("map", __name__)

VALID_NODE_TYPES = {
    # Navigation Checkpoints
    "entrance", "exit", "exhibit", "artifact", "waypoint", "junction", "doorway", "room",
    # Vertical & Floor Connectors
    "elevator", "stairs", "escalator", "ramp",
    # Amenities & Facilities
    "restroom", "amenity", "fire_extinguisher", "information_desk",
    "cafeteria", "cafe", "gift_shop", "giftshop", "water_fountain",
    "first_aid", "emergency_exit", "ticket_counter", "ticketing",
    "locker", "cloakroom", "atm", "bench", "seating", "security"
}


# ---------------------------------------------------------------------------
# Floor Plans
# ---------------------------------------------------------------------------

@map_bp.route("/floor-plans", methods=["GET"])
def list_floor_plans():
    try:
        museum_id = request.args.get("museum_id")
        plans = get_all_floor_plans(museum_id=museum_id)
        return jsonify({"data": plans}), 200
    except Exception as e:
        logging.error(f"Error listing floor plans: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/floor-plans/<plan_id>", methods=["GET"])
def get_floor_plan(plan_id):
    try:
        plan = get_floor_plan_by_id(plan_id)
        if not plan:
            return jsonify({"error": "Floor plan not found"}), 404
        return jsonify({"data": plan}), 200
    except Exception as e:
        logging.error(f"Error getting floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/floor-plans", methods=["POST"])
def add_floor_plan():
    try:
        data = request.get_json()
        required_fields = ["name", "floor_number"]
        if not data or not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        plan = create_floor_plan(
            name=data["name"],
            floor_number=data["floor_number"],
            image_url=data.get("image_url"),
            width_px=data.get("width_px"),
            height_px=data.get("height_px"),
            scale_meters_per_px=data.get("scale_meters_per_px"),
            is_outdoor=data.get("is_outdoor", False),
            museum_id=data.get("museum_id"),
        )
        return jsonify({"data": plan}), 201
    except Exception as e:
        logging.error(f"Error creating floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/floor-plans/<plan_id>", methods=["PATCH"])
def edit_floor_plan(plan_id):
    try:
        data = request.get_json()
        plan = update_floor_plan(plan_id, data)
        if not plan:
            return jsonify({"error": "Floor plan not found"}), 404
        return jsonify({"data": plan}), 200
    except Exception as e:
        logging.error(f"Error updating floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


def _clear_floor_plan_georeference_internal(plan_id):
    from app.utils.db import execute_query
    plan = get_floor_plan_by_id(plan_id)
    if not plan:
        return None, "Floor plan not found"

    execute_query(
        """
        UPDATE floor_plans 
        SET anchor_1_lat = NULL, anchor_1_lng = NULL, 
            anchor_2_lat = NULL, anchor_2_lng = NULL,
            anchor_1_x_px = NULL, anchor_1_y_px = NULL,
            anchor_2_x_px = NULL, anchor_2_y_px = NULL,
            affine_transform = NULL
        WHERE id = %s::uuid
        """,
        (plan_id,),
        commit=True,
    )
    execute_query("DELETE FROM map_anchors WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
    execute_query(
        "UPDATE map_nodes SET latitude = NULL, longitude = NULL, is_manually_corrected = FALSE WHERE floor_plan_id = %s::uuid",
        (plan_id,),
        commit=True,
    )
    execute_query(
        """
        UPDATE room_boundaries rb
        SET latitude = NULL, longitude = NULL, is_manually_corrected = FALSE
        FROM rooms r
        WHERE rb.room_id = r.id AND r.floor_plan_id = %s::uuid
        """,
        (plan_id,),
        commit=True,
    )
    edges = execute_query(
        """
        SELECT e.id, fn.x_coordinate, fn.y_coordinate, tn.x_coordinate, tn.y_coordinate
        FROM map_edges e
        JOIN map_nodes fn ON e.from_node_id = fn.id
        JOIN map_nodes tn ON e.to_node_id = tn.id
        WHERE fn.floor_plan_id = %s::uuid
        """,
        (plan_id,),
        fetch=True,
    )
    w = float(plan.get("width_px") or 1000.0)
    h = float(plan.get("height_px") or 1000.0)
    for edge_id, x1, y1, x2, y2 in (edges or []):
        if x1 is not None and x2 is not None:
            dx = (float(x1) - float(x2)) * w if float(x1) <= 1.0 and float(x2) <= 1.0 else (float(x1) - float(x2))
            dy = (float(y1 or 0) - float(y2 or 0)) * h if float(y1 or 0) <= 1.0 and float(y2 or 0) <= 1.0 else (float(y1 or 0) - float(y2 or 0))
            dist = max(0.5, round(math.hypot(dx, dy) * 0.035, 2))
            execute_query("UPDATE map_edges SET distance = %s WHERE id = %s::uuid", (dist, edge_id), commit=True)

    invalidate_room_route_cache()
    updated_plan = get_floor_plan_by_id(plan_id)
    return updated_plan, None


@map_bp.route("/floor-plans/<plan_id>/georeference", methods=["PUT"])
def georeference_floor_plan(plan_id):
    try:
        data = request.get_json() or {}
        plan = get_floor_plan_by_id(plan_id)
        if not plan:
            return jsonify({"error": "Floor plan not found"}), 404

        # Check if caller wants to clear georeferencing
        if data.get("clear") or (data.get("anchor_1_lat") is None and data.get("anchors") is None):
            updated_plan, err = _clear_floor_plan_georeference_internal(plan_id)
            if err:
                return jsonify({"error": err}), 404
            return jsonify({"data": updated_plan, "message": "Georeference cleared. Running in indoor (x,y) mode."}), 200

        w = float(plan.get("width_px") or 1000)
        h = float(plan.get("height_px") or 1000)

        anchors_input = data.get("anchors")
        update_data: dict[str, Any] = {}

        if anchors_input and isinstance(anchors_input, list) and len(anchors_input) >= 2:
            norm_anchors = []
            for a in anchors_input:
                lat = float(a.get("latitude") if a.get("latitude") is not None else a.get("lat", 0))
                lng = float(a.get("longitude") if a.get("longitude") is not None else a.get("lng", 0))

                if "map_x" in a and "map_y" in a:
                    mx = float(a["map_x"])
                    my = float(a["map_y"])
                    norm_x = mx if mx <= 1.0 else (mx / w if w > 0 else 0.0)
                    norm_y = my if my <= 1.0 else (my / h if h > 0 else 0.0)
                else:
                    x_px = float(a.get("x_px", a.get("x", 0)))
                    y_px = float(a.get("y_px", a.get("y", 0)))
                    norm_x = x_px / w if w > 0 else 0.0
                    norm_y = y_px / h if h > 0 else 0.0

                norm_anchors.append({
                    "map_x": max(0.0, min(1.0, norm_x)),
                    "map_y": max(0.0, min(1.0, norm_y)),
                    "latitude": lat,
                    "longitude": lng,
                })

            affine = affine_transform_from_anchors(norm_anchors)
            if affine:
                update_data["affine_transform"] = affine

            a1 = norm_anchors[0]
            a2 = norm_anchors[1]
            dist_m = haversine_distance(a1["latitude"], a1["longitude"], a2["latitude"], a2["longitude"])
            dx_px = (a2["map_x"] - a1["map_x"]) * w
            dy_px = (a2["map_y"] - a1["map_y"]) * h
            dist_px = (dx_px**2 + dy_px**2)**0.5
            if dist_px > 0:
                update_data["scale_meters_per_px"] = round(dist_m / dist_px, 4)

            update_data["anchor_1_x_px"] = a1["map_x"] * w
            update_data["anchor_1_y_px"] = a1["map_y"] * h
            update_data["anchor_1_lat"] = a1["latitude"]
            update_data["anchor_1_lng"] = a1["longitude"]

            update_data["anchor_2_x_px"] = a2["map_x"] * w
            update_data["anchor_2_y_px"] = a2["map_y"] * h
            update_data["anchor_2_lat"] = a2["latitude"]
            update_data["anchor_2_lng"] = a2["longitude"]

            from app.models.map_anchor import create_anchor
            from app.utils.db import execute_query
            execute_query("DELETE FROM map_anchors WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
            for na in norm_anchors:
                create_anchor(plan_id, na["map_x"], na["map_y"], na["latitude"], na["longitude"])

        else:
            required = [
                "anchor_1_x_px", "anchor_1_y_px", "anchor_1_lat", "anchor_1_lng",
                "anchor_2_x_px", "anchor_2_y_px", "anchor_2_lat", "anchor_2_lng",
            ]
            if not all(field in data for field in required):
                return jsonify({"error": "Missing required georeferencing fields (provide either anchors list with >= 2 points or anchor_1/anchor_2)"}), 400

            for k in required:
                update_data[k] = data[k]

            norm_anchors = [
                {
                    "map_x": float(data["anchor_1_x_px"]) / w if w > 0 else 0.0,
                    "map_y": float(data["anchor_1_y_px"]) / h if h > 0 else 0.0,
                    "latitude": float(data["anchor_1_lat"]),
                    "longitude": float(data["anchor_1_lng"]),
                },
                {
                    "map_x": float(data["anchor_2_x_px"]) / w if w > 0 else 0.0,
                    "map_y": float(data["anchor_2_y_px"]) / h if h > 0 else 0.0,
                    "latitude": float(data["anchor_2_lat"]),
                    "longitude": float(data["anchor_2_lng"]),
                }
            ]
            affine = affine_transform_from_anchors(norm_anchors)
            if affine:
                update_data["affine_transform"] = affine

            dist_m = haversine_distance(norm_anchors[0]["latitude"], norm_anchors[0]["longitude"], norm_anchors[1]["latitude"], norm_anchors[1]["longitude"])
            dx_px = float(data["anchor_2_x_px"]) - float(data["anchor_1_x_px"])
            dy_px = float(data["anchor_2_y_px"]) - float(data["anchor_1_y_px"])
            dist_px = (dx_px**2 + dy_px**2)**0.5
            if dist_px > 0:
                update_data["scale_meters_per_px"] = round(dist_m / dist_px, 4)

            from app.models.map_anchor import create_anchor
            from app.utils.db import execute_query
            execute_query("DELETE FROM map_anchors WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
            for na in norm_anchors:
                create_anchor(plan_id, na["map_x"], na["map_y"], na["latitude"], na["longitude"])

        plan = update_floor_plan(plan_id, update_data)
        if not plan:
            return jsonify({"error": "Floor plan not found"}), 404
        invalidate_room_route_cache()
        return jsonify({"data": plan, "message": "Georeferenced successfully"}), 200
    except Exception as e:
        logging.error(f"Error georeferencing floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/floor-plans/<plan_id>/georeference", methods=["DELETE"])
def delete_floor_plan_georeference(plan_id):
    try:
        updated_plan, err = _clear_floor_plan_georeference_internal(plan_id)
        if err:
            return jsonify({"error": err}), 404
        return jsonify({"data": updated_plan, "message": "Georeference cleared. Running in indoor (x,y) mode."}), 200
    except Exception as e:
        logging.error(f"Error clearing floor plan georeference: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/floor-plans/<plan_id>/recompute-latlng", methods=["POST"])
def recompute_floor_plan_latlng(plan_id):
    try:
        from app.utils.db import execute_query

        plan = get_floor_plan_by_id(plan_id)
        if not plan:
            return jsonify({"error": "Floor plan not found"}), 404

        test_lat, test_lng = map_xy_to_gps(0.5, 0.5, plan)
        if test_lat is None or test_lng is None:
            return jsonify({
                "warning": "floor plan not georeferenced — lat/lng not set.",
                "updated_count": 0
            }), 200

        nodes = get_all_nodes(floor_plan_id=plan_id)
        updated_count = 0
        skipped_corrected_points = []

        for node in nodes:
            if not node:
                continue
            if node.get("is_manually_corrected"):
                skipped_info = {
                    "id": str(node["id"]),
                    "name": node.get("name"),
                    "reason": "node is_manually_corrected is True"
                }
                skipped_corrected_points.append(skipped_info)
                logging.info(f"Skipping manually corrected node {node['id']} ({node.get('name')})")
                continue

            x = node.get("x_coordinate", 0)
            y = node.get("y_coordinate", 0)
            lat, lng = map_xy_to_gps(x, y, plan)
            if lat is not None and lng is not None:
                execute_query(
                    "UPDATE map_nodes SET latitude = %s, longitude = %s WHERE id = %s::uuid",
                    (lat, lng, node["id"]),
                    commit=True,
                )
                updated_count += 1

                # Recompute edge weights for edges connected to this node
                edges = execute_query(
                    "SELECT id, from_node_id, to_node_id FROM map_edges WHERE from_node_id = %s::uuid OR to_node_id = %s::uuid",
                    (node["id"], node["id"]),
                    fetch=True,
                )
                for edge in (edges or []):
                    edge_id, from_id, to_id = edge
                    f_node = get_node_by_id(str(from_id))
                    t_node = get_node_by_id(str(to_id))
                    if (f_node and t_node and f_node.get("latitude") is not None and t_node.get("latitude") is not None):
                        dist = haversine_distance(
                            f_node["latitude"], f_node["longitude"],
                            t_node["latitude"], t_node["longitude"]
                        )
                        execute_query(
                            "UPDATE map_edges SET distance = %s WHERE id = %s::uuid",
                            (round(dist, 2), edge_id),
                            commit=True,
                        )

        # Process room boundaries for this floor plan
        b_query = """
            SELECT rb.id, rb.room_id, rb.corner_order, rb.x, rb.y, rb.is_manually_corrected, r.name
            FROM room_boundaries rb
            JOIN rooms r ON rb.room_id = r.id
            WHERE r.floor_plan_id = %s::uuid
        """
        b_rows = execute_query(b_query, (plan_id,), fetch=True) or []
        updated_boundaries_count = 0

        for b in b_rows:
            b_id, b_room_id, b_order, b_x, b_y, is_manual, r_name = b[0], b[1], b[2], b[3], b[4], bool(b[5]), b[6]
            if is_manual:
                skipped_info = {
                    "id": str(b_id),
                    "room_id": str(b_room_id),
                    "room_name": r_name,
                    "corner_order": b_order,
                    "reason": "is_manually_corrected is True"
                }
                skipped_corrected_points.append(skipped_info)
                logging.info(f"Skipping manually corrected boundary point {b_id} for room {r_name} (corner {b_order})")
                continue

            lat, lng = map_xy_to_gps(b_x, b_y, plan)
            if lat is not None and lng is not None:
                execute_query(
                    "UPDATE room_boundaries SET latitude = %s, longitude = %s WHERE id = %s::uuid",
                    (lat, lng, str(b_id)),
                    commit=True
                )
                updated_boundaries_count += 1

        # Also sync boundary_polygon to galleries table for these rooms
        try:
            import json
            rooms_in_plan = execute_query("SELECT id, name FROM rooms WHERE floor_plan_id = %s::uuid", (plan_id,), fetch=True) or []
            for r_row in rooms_in_plan:
                r_id, r_name = str(r_row[0]), r_row[1]
                rb_points = execute_query(
                    "SELECT x, y, latitude, longitude FROM room_boundaries WHERE room_id = %s::uuid ORDER BY corner_order",
                    (r_id,),
                    fetch=True
                ) or []
                if rb_points:
                    poly_data = [{"x": p[0], "y": p[1], "lat": p[2], "lng": p[3]} for p in rb_points]
                    execute_query(
                        "UPDATE galleries SET boundary_polygon = %s WHERE name ILIKE %s",
                        (json.dumps(poly_data), f"%{r_name}%"),
                        commit=True
                    )
        except Exception as sync_err:
            logging.warning(f"Failed to sync boundary polygon to galleries table: {sync_err}")

        invalidate_room_route_cache()
        return jsonify({
            "success": True,
            "updated_count": updated_count,
            "updated_boundaries_count": updated_boundaries_count,
            "skipped_corrected_points": skipped_corrected_points,
            "message": f"Updated {updated_count} nodes and {updated_boundaries_count} boundary points with new coordinates ({len(skipped_corrected_points)} manually corrected points skipped)"
        }), 200

    except Exception as e:
        logging.error(f"Error recomputing floor plan latlng: {e}")
        return jsonify({"error": str(e)}), 500


@map_bp.route("/floor-plans/<plan_id>", methods=["DELETE"])
def remove_floor_plan(plan_id):
    try:
        success = delete_floor_plan(plan_id)
        if not success:
            return jsonify({"error": "Floor plan not found"}), 404
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.error(f"Error deleting floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/floor-plans/<plan_id>/clear-data", methods=["POST"])
def clear_floor_plan_data(plan_id):
    try:
        from app.utils.db import execute_query
        # 1. Delete edges connected to any node of this floor plan
        execute_query(
            "DELETE FROM map_edges WHERE from_node_id IN (SELECT id FROM map_nodes WHERE floor_plan_id = %s::uuid) "
            "OR to_node_id IN (SELECT id FROM map_nodes WHERE floor_plan_id = %s::uuid)",
            (plan_id, plan_id), commit=True
        )
        # 2. Delete nodes
        execute_query("DELETE FROM map_nodes WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
        # 3. Delete artifacts associated with floor plan
        execute_query("DELETE FROM artifacts WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
        # 4. Delete wifi fingerprints for rooms of this floor plan
        try:
            execute_query(
                "DELETE FROM wifi_fingerprints WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)",
                (plan_id,), commit=True
            )
        except Exception:
            pass
        # 5. Delete doorways for rooms of this floor plan
        execute_query(
            "DELETE FROM doorway_openings WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)",
            (plan_id,), commit=True
        )
        # 6. Delete room boundaries
        execute_query(
            "DELETE FROM room_boundaries WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)",
            (plan_id,), commit=True
        )
        # 7. Delete rooms
        execute_query("DELETE FROM rooms WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
        # 8. Delete footprint
        try:
            execute_query("DELETE FROM floor_plan_footprints WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
        except Exception:
            pass
        return jsonify({"success": True, "message": "All floor plan marks, boundaries, and paths cleared successfully."}), 200
    except Exception as e:
        logging.error(f"Error clearing floor plan data: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Upload Map
# ---------------------------------------------------------------------------

@map_bp.route("/upload-map", methods=["POST"])
def upload_map():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file part"}), 400
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"error": "No selected file"}), 400

        filename = secure_filename(file.filename)
        ext = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        upload_dir = os.path.join(os.getcwd(), "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, unique_filename)
        file.save(file_path)
        url = f"/api/static/uploads/{unique_filename}"
        return jsonify({"url": url}), 201
    except Exception as e:
        logging.error(f"Error uploading file: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

@map_bp.route("/nodes", methods=["GET"])
def list_nodes():
    try:
        floor = request.args.get("floor", type=int)
        floor_plan_id = request.args.get("floor_plan_id")
        museum_id = request.args.get("museum_id", type=int)
        nodes = get_all_nodes(floor_plan_id=floor_plan_id, floor=floor, museum_id=museum_id)
        return jsonify({"data": nodes}), 200
    except Exception as e:
        logging.error(f"Error listing nodes: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/nodes/<node_id>", methods=["GET"])
def get_node(node_id):
    try:
        node = get_node_by_id(node_id)
        if not node:
            return jsonify({"error": "Node not found"}), 404
        return jsonify({"data": node}), 200
    except Exception as e:
        logging.error(f"Error getting node: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/nodes", methods=["POST"])
def add_node():
    try:
        data = request.get_json()
        required_fields = ["name", "floor", "node_type"]
        if not data or not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        node_type = data["node_type"]
        if isinstance(node_type, list):
            node_type = ",".join(node_type)
        types_list = [t.strip().lower() for t in str(node_type).split(",") if t.strip()]
        if not types_list or not all((t in VALID_NODE_TYPES or bool(re.match(r"^[a-z0-9_-]+$", t))) for t in types_list):
            return jsonify({"error": "Invalid node_type"}), 400
        node_type = ",".join(types_list)

        # Exhibit / Artifact linkage constraint
        is_exhibit = any(t in ["exhibit", "artifact"] for t in types_list)
        artifact_id = data.get("artifact_id")
        object_id = data.get("object_id")
        if is_exhibit:
            if not artifact_id:
                return jsonify({"error": "Exhibit and artifact nodes must be linked to an existing artifact (artifact_id required)"}), 400

        x = float(data.get("x_coordinate", data.get("x", 0)))
        y = float(data.get("y_coordinate", data.get("y", 0)))
        fp_id = data.get("floor_plan_id")
        fp = None

        if fp_id:
            fp = get_floor_plan_by_id(fp_id)
            if fp:
                w = float(fp.get("width_px") or 0)
                h = float(fp.get("height_px") or 0)
                if w > 0 and x > 1.0:
                    x = x / w
                if h > 0 and y > 1.0:
                    y = y / h

            x = max(0.0, min(1.0, x))
            y = max(0.0, min(1.0, y))

            is_valid, err_msg = validate_point_in_footprint(fp_id, x, y)
            if not is_valid:
                return jsonify({"error": err_msg}), 400

        lat = data.get("latitude")
        lng = data.get("longitude")
        warning = None

        if (lat is None or lng is None) and fp_id:
            if fp:
                computed_lat, computed_lng = map_xy_to_gps(x, y, fp)
                if computed_lat is not None and computed_lng is not None:
                    lat = computed_lat
                    lng = computed_lng
                else:
                    warning = "floor plan not georeferenced — lat/lng not set."
            else:
                warning = "floor plan not georeferenced — lat/lng not set."
        elif (lat is None or lng is None) and not fp_id:
            warning = "floor plan not georeferenced — lat/lng not set."

        if is_exhibit:
            from app.utils.db import execute_query
            from app.models.artifact import get_artifact, create_artifact

            # If object_id is provided, verify it exists in objects table
            if object_id:
                obj_row = execute_query(
                    "SELECT id, name, description, latitude, longitude FROM objects WHERE id = %s",
                    (object_id,),
                    fetchone=True
                )
                if not obj_row:
                    return jsonify({"error": f"Object with ID {object_id} not found"}), 400

                # If artifact_id is missing, find or auto-create corresponding artifact for this floor plan
                if not artifact_id and fp_id:
                    existing_art = execute_query(
                        "SELECT id FROM artifacts WHERE floor_plan_id = %s::uuid AND name = %s LIMIT 1",
                        (fp_id, obj_row[1]),
                        fetchone=True
                    )
                    if existing_art:
                        artifact_id = str(existing_art[0])
                    else:
                        new_art = create_artifact({
                            "floor_plan_id": fp_id,
                            "name": obj_row[1],
                            "description": obj_row[2],
                            "map_x": x,
                            "map_y": y,
                            "latitude": lat,
                            "longitude": lng
                        })
                        if new_art:
                            artifact_id = str(new_art["id"])

            if artifact_id:
                art = get_artifact(artifact_id)
                if not art:
                    return jsonify({"error": f"Artifact with ID {artifact_id} not found"}), 400

                # If object_id was not provided, link to matching object by name if exists
                if not object_id and art.get("name"):
                    matching_obj = execute_query(
                        "SELECT id FROM objects WHERE name ILIKE %s LIMIT 1",
                        (art["name"],),
                        fetchone=True
                    )
                    if matching_obj:
                        object_id = matching_obj[0]
                    else:
                        museum_id = None
                        if fp_id:
                            fp_row = execute_query("SELECT museum_id FROM floor_plans WHERE id = %s::uuid", (fp_id,), fetchone=True)
                            if fp_row and fp_row[0]:
                                museum_id = fp_row[0]
                        if not museum_id:
                            m_row = execute_query("SELECT id FROM museums ORDER BY id LIMIT 1", fetchone=True)
                            if m_row:
                                museum_id = m_row[0]
                        if museum_id:
                            new_obj = execute_query(
                                "INSERT INTO objects (name, description, museum_id, latitude, longitude, category) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                                (art["name"], art.get("description"), museum_id, lat, lng, "Exhibit"),
                                fetchone=True,
                                commit=True
                            )
                            if new_obj:
                                object_id = new_obj[0]

        node = create_node(
            name=data["name"],
            floor=data["floor"],
            x=x,
            y=y,
            node_type=node_type,
            floor_plan_id=fp_id,
            object_id=object_id,
            latitude=lat,
            longitude=lng,
            is_must_visit=data.get("is_must_visit", False),
            artifact_id=artifact_id,
        )
        invalidate_room_route_cache()
        res_payload: dict[str, Any] = {"data": node}
        if warning:
            res_payload["warning"] = warning
        return jsonify(res_payload), 201
    except Exception as e:
        logging.error(f"Error creating node: {e}")
        return jsonify({"error": str(e)}), 500


@map_bp.route("/nodes/<node_id>", methods=["PUT"])
def edit_node(node_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing required fields"}), 400

        node = get_node_by_id(node_id)
        if not node:
            return jsonify({"error": "Node not found"}), 404

        node_type = data.get("node_type", node.get("node_type", ""))
        if isinstance(node_type, list):
            node_type = ",".join(node_type)
        types_list = [t.strip().lower() for t in str(node_type).split(",") if t.strip()]
        if "node_type" in data:
            if not types_list or not all((t in VALID_NODE_TYPES or bool(re.match(r"^[a-z0-9_-]+$", t))) for t in types_list):
                return jsonify({"error": "Invalid node_type"}), 400
            node_type = ",".join(types_list)
        is_exhibit = any(t in ["exhibit", "artifact"] for t in types_list)
        artifact_id = data.get("artifact_id", node.get("artifact_id"))
        object_id = data.get("object_id", node.get("object_id"))
        if is_exhibit:
            if not artifact_id and not object_id:
                return jsonify({"error": "Exhibit and artifact nodes must be linked to an existing artifact (artifact_id required)"}), 400

        raw_x = data.get("x_coordinate", node.get("x_coordinate", 0))
        raw_y = data.get("y_coordinate", node.get("y_coordinate", 0))
        x = float(raw_x) if raw_x is not None else 0.0
        y = float(raw_y) if raw_y is not None else 0.0
        fp_id = data.get("floor_plan_id", node.get("floor_plan_id"))
        fp = None

        if fp_id:
            fp = get_floor_plan_by_id(fp_id)
            if fp:
                w = float(fp.get("width_px") or 0)
                h = float(fp.get("height_px") or 0)
                if w > 0 and x > 1.0:
                    x = x / w
                if h > 0 and y > 1.0:
                    y = y / h
            x = max(0.0, min(1.0, x))
            y = max(0.0, min(1.0, y))
            data["x_coordinate"] = x
            data["y_coordinate"] = y

            is_valid, err_msg = validate_point_in_footprint(fp_id, x, y)
            if not is_valid:
                return jsonify({"error": err_msg}), 400

        lat = data.get("latitude")
        lng = data.get("longitude")
        warning = None

        if (lat is None or lng is None) and fp_id:
            if fp:
                computed_lat, computed_lng = map_xy_to_gps(x, y, fp)
                if computed_lat is not None and computed_lng is not None:
                    lat = computed_lat
                    lng = computed_lng
                else:
                    warning = "floor plan not georeferenced — lat/lng not set."
            else:
                warning = "floor plan not georeferenced — lat/lng not set."
        elif (lat is None or lng is None) and not fp_id:
            warning = "floor plan not georeferenced — lat/lng not set."

        if is_exhibit:
            from app.utils.db import execute_query
            from app.models.artifact import get_artifact, create_artifact

            if object_id:
                obj_row = execute_query(
                    "SELECT id, name, description, latitude, longitude FROM objects WHERE id = %s",
                    (object_id,),
                    fetchone=True
                )
                if not obj_row:
                    return jsonify({"error": f"Object with ID {object_id} not found"}), 400

                if not artifact_id and fp_id:
                    existing_art = execute_query(
                        "SELECT id FROM artifacts WHERE floor_plan_id = %s::uuid AND name = %s LIMIT 1",
                        (fp_id, obj_row[1]),
                        fetchone=True
                    )
                    if existing_art:
                        artifact_id = str(existing_art[0])
                    else:
                        new_art = create_artifact({
                            "floor_plan_id": fp_id,
                            "name": obj_row[1],
                            "description": obj_row[2],
                            "map_x": x,
                            "map_y": y,
                            "latitude": lat,
                            "longitude": lng
                        })
                        if new_art:
                            artifact_id = str(new_art["id"])

            if artifact_id:
                art = get_artifact(artifact_id)
                if not art:
                    return jsonify({"error": f"Artifact with ID {artifact_id} not found"}), 400
                if not object_id and art.get("name"):
                    matching_obj = execute_query(
                        "SELECT id FROM objects WHERE name ILIKE %s LIMIT 1",
                        (art["name"],),
                        fetchone=True
                    )
                    if matching_obj:
                        object_id = matching_obj[0]

        if lat is not None:
            data["latitude"] = lat
        if lng is not None:
            data["longitude"] = lng
        if artifact_id is not None:
            data["artifact_id"] = artifact_id
        if object_id is not None:
            data["object_id"] = object_id

        updated_node = update_node(node_id, data)
        invalidate_room_route_cache()
        res_payload: dict[str, Any] = {"data": updated_node}
        if warning:
            res_payload["warning"] = warning
        return jsonify(res_payload), 200
    except Exception as e:
        logging.error(f"Error updating node: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/nodes/<node_id>/coordinates", methods=["PATCH"])
def update_node_coordinates(node_id):
    """Admin click-to-place coordinate assignment with full guardrails."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing payload"}), 400

        node = get_node_by_id(node_id)
        if not node:
            return jsonify({"error": "Node not found"}), 404

        raw_lat = data.get("latitude")
        raw_lng = data.get("longitude")

        lat = None
        lng = None

        if raw_lat is not None and raw_lng is not None and str(raw_lat).strip() != "" and str(raw_lng).strip() != "":
            try:
                lat = float(raw_lat)
                lng = float(raw_lng)
            except (ValueError, TypeError):
                return jsonify({"error": "Coordinates must be numeric"}), 400

            if lat < -90 or lat > 90 or lng < -180 or lng > 180:
                return jsonify({"error": "Coordinates out of valid range"}), 400

            if lat == 0.0 and lng == 0.0:
                return jsonify({"error": "Suspicious coordinates (0,0) rejected"}), 400

            bbox_min_lat = 8.0
            bbox_max_lat = 30.0
            bbox_min_lng = 68.0
            bbox_max_lng = 97.0

            if lat < bbox_min_lat or lat > bbox_max_lat or lng < bbox_min_lng or lng > bbox_max_lng:
                return jsonify({"error": "Coordinates fall outside the museum bounding box"}), 400
        else:
            # Lat/Lng optional: indoor-only mapping works with pure (x, y) coordinates
            lat = None
            lng = None

        fp_id = data.get("floor_plan_id") or node.get("floor_plan_id")
        nx = float(data["x_coordinate"]) if "x_coordinate" in data and data["x_coordinate"] is not None else node.get("x_coordinate")
        ny = float(data["y_coordinate"]) if "y_coordinate" in data and data["y_coordinate"] is not None else node.get("y_coordinate")

        if fp_id:
            fp = get_floor_plan_by_id(fp_id)
            if fp:
                w = float(fp.get("width_px") or 0)
                h = float(fp.get("height_px") or 0)
                if nx is not None and w > 0 and nx > 1.0:
                    nx = nx / w
                if ny is not None and h > 0 and ny > 1.0:
                    ny = ny / h
                if nx is not None:
                    nx = max(0.0, min(1.0, nx))
                if ny is not None:
                    ny = max(0.0, min(1.0, ny))

                # If lat/lng were not explicitly passed, try to auto-derive from x, y if floor plan is georeferenced
                if lat is None and lng is None and nx is not None and ny is not None:
                    computed_lat, computed_lng = map_xy_to_gps(nx, ny, fp)
                    if computed_lat is not None and computed_lng is not None:
                        lat = computed_lat
                        lng = computed_lng
                # If x, y were not passed but lat, lng were, derive x, y
                elif (nx is None or ny is None) and lat is not None and lng is not None and fp.get("anchor_1_lat"):
                    from app.utils.geo import gps_to_map_xy
                    nx, ny = gps_to_map_xy(lat, lng, fp)

            if nx is not None and ny is not None:
                # 1. Building footprint validation
                is_valid, err_msg = validate_point_in_footprint(fp_id, nx, ny)
                if not is_valid:
                    return jsonify({"error": err_msg}), 400

                # 2. Room boundary containment validation
                target_room_id = data.get("room_id")
                target_room_name = data.get("room_name")
                if target_room_id or target_room_name:
                    rooms = get_rooms_by_floor_plan(fp_id)
                    matched_room = next((r for r in rooms if (target_room_id and r["id"] == str(target_room_id)) or (target_room_name and r["name"].lower() == str(target_room_name).lower())), None)
                    if matched_room and matched_room.get("boundaries") and len(matched_room["boundaries"]) >= 3:
                        poly = [{"x": b["x"], "y": b["y"]} for b in matched_room["boundaries"]]
                        if not point_in_polygon(nx, ny, poly):
                            return jsonify({"error": f"Position falls outside the {matched_room['name']} boundary — check placement."}), 400

        from app.utils.db import execute_query

        # Reject duplicate coordinates on another node if lat/lng are set
        if lat is not None and lng is not None:
            existing = execute_query(
                "SELECT id FROM map_nodes WHERE id != %s::uuid AND latitude = %s AND longitude = %s LIMIT 1",
                (node_id, lat, lng),
                fetch=True,
            )
            if existing:
                return jsonify({"error": "Duplicate coordinates with another node"}), 400

        # Save the coordinate and manual flag
        is_manual = bool(data.get("is_manually_corrected", False))
        if nx is not None and ny is not None:
            execute_query(
                "UPDATE map_nodes SET latitude = %s, longitude = %s, x_coordinate = %s, y_coordinate = %s, is_manually_corrected = %s WHERE id = %s::uuid",
                (lat, lng, nx, ny, is_manual, node_id),
                commit=True,
            )
        else:
            execute_query(
                "UPDATE map_nodes SET latitude = %s, longitude = %s, is_manually_corrected = %s WHERE id = %s::uuid",
                (lat, lng, is_manual, node_id),
                commit=True,
            )

        # Recompute all connected edge weights via Haversine (if GPS set) or Euclidean scale (if x,y set)
        edges = execute_query(
            "SELECT id, from_node_id, to_node_id FROM map_edges WHERE from_node_id = %s::uuid OR to_node_id = %s::uuid",
            (node_id, node_id),
            fetch=True,
        )

        if edges:
            nodes_cache = {str(node_id): {"lat": lat, "lng": lng, "x": nx, "y": ny}}

            def get_coords(nid):
                nid_str = str(nid)
                if nid_str in nodes_cache:
                    return nodes_cache[nid_str]
                n = get_node_by_id(nid_str)
                if n:
                    nodes_cache[nid_str] = {
                        "lat": n.get("latitude"),
                        "lng": n.get("longitude"),
                        "x": n.get("x_coordinate"),
                        "y": n.get("y_coordinate"),
                    }
                return nodes_cache.get(nid_str)

            for edge in edges:
                edge_id, from_id, to_id = edge
                fc = get_coords(from_id)
                tc = get_coords(to_id)
                dist = None
                if fc and tc:
                    if (fc.get("lat") is not None and tc.get("lat") is not None
                            and fc.get("lng") is not None and tc.get("lng") is not None):
                        dist = round(haversine_distance(fc["lat"], fc["lng"], tc["lat"], tc["lng"]), 2)
                    elif (fc.get("x") is not None and tc.get("x") is not None
                          and fc.get("y") is not None and tc.get("y") is not None):
                        w = 1000.0
                        h = 1000.0
                        if fp_id:
                            fp_obj = get_floor_plan_by_id(fp_id)
                            if fp_obj:
                                w = float(fp_obj.get("width_px") or 1000.0)
                                h = float(fp_obj.get("height_px") or 1000.0)
                        x1 = float(fc["x"])
                        y1 = float(fc["y"])
                        x2 = float(tc["x"])
                        y2 = float(tc["y"])
                        dx = (x1 - x2) * w if x1 <= 1.0 and x2 <= 1.0 else (x1 - x2)
                        dy = (y1 - y2) * h if y1 <= 1.0 and y2 <= 1.0 else (y1 - y2)
                        dist = max(0.5, round(math.hypot(dx, dy) * 0.035, 2))
                if dist is not None:
                    execute_query("UPDATE map_edges SET distance = %s WHERE id = %s::uuid", (dist, edge_id), commit=True)

        node["latitude"] = lat
        node["longitude"] = lng
        if nx is not None:
            node["x_coordinate"] = nx
        if ny is not None:
            node["y_coordinate"] = ny
        invalidate_room_route_cache()
        return jsonify({"data": node, "message": "Coordinates updated and edge weights recomputed."}), 200

    except Exception as e:
        logging.error(f"Error updating coordinates: {e}")
        return jsonify({"error": str(e)}), 500


@map_bp.route("/nodes/<node_id>", methods=["DELETE"])
def remove_node(node_id):
    node = get_node_by_id(node_id)
    if not node:
        return jsonify({"error": "Node not found"}), 404
    try:
        from app.utils.db import execute_query
        execute_query(
            "DELETE FROM map_edges WHERE from_node_id = %s::uuid OR to_node_id = %s::uuid",
            (node_id, node_id),
            commit=True,
        )
        delete_node(node_id)
        invalidate_room_route_cache()
        return jsonify({"message": "Node deleted successfully"})
    except Exception as e:
        logging.error(f"Error deleting node: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Edges
# ---------------------------------------------------------------------------

@map_bp.route("/edges", methods=["GET"])
def list_edges():
    try:
        museum_id = request.args.get("museum_id", type=int)
        floor_plan_id = request.args.get("floor_plan_id")
        edges = get_all_edges(museum_id=museum_id, floor_plan_id=floor_plan_id)
        return jsonify({"data": edges}), 200
    except Exception as e:
        logging.error(f"Error listing edges: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/edges", methods=["POST"])
def add_edge():
    """
    Create a walkable edge between two nodes.
    - Distance is always auto-computed via Haversine.
    - Cross-floor edges require elevator/stairs/escalator node type.
    - edge_type must be specified for floor-change connectors.
    """
    try:
        data = request.get_json()
        required_fields = ["from_node_id", "to_node_id"]
        if not data or not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        from_node = get_node_by_id(data["from_node_id"])
        to_node = get_node_by_id(data["to_node_id"])

        if not from_node or not to_node:
            return jsonify({"error": "One or both nodes not found"}), 404

        edge_type = data.get("edge_type", "normal")

        # Cross-floor guardrail
        if from_node["floor"] != to_node["floor"]:
            floor_connectors = {"elevator", "stairs", "escalator"}
            if from_node["node_type"] not in floor_connectors and to_node["node_type"] not in floor_connectors:
                return jsonify({"error": "Cross-floor edges must connect to an elevator, stairs, or escalator node"}), 400
            # Force edge_type to match the connector
            if edge_type == "normal":
                for nt in [from_node["node_type"], to_node["node_type"]]:
                    if nt in floor_connectors:
                        edge_type = nt
                        break

        # Room boundary wall-crossing validation
        fp_id = from_node.get("floor_plan_id") or to_node.get("floor_plan_id")
        if fp_id:
            x1 = from_node.get("x_coordinate") if from_node.get("x_coordinate") is not None else from_node.get("longitude")
            y1 = from_node.get("y_coordinate") if from_node.get("y_coordinate") is not None else from_node.get("latitude")
            x2 = to_node.get("x_coordinate") if to_node.get("x_coordinate") is not None else to_node.get("longitude")
            y2 = to_node.get("y_coordinate") if to_node.get("y_coordinate") is not None else to_node.get("latitude")

            if x1 is not None and y1 is not None and x2 is not None and y2 is not None:
                rooms = get_rooms_by_floor_plan(fp_id)
                doorways = get_doorways_by_floor_plan(fp_id)
                if rooms:
                    from_is_entrance = from_node.get("node_type") == "entrance" or "entrance" in (from_node.get("name") or "").lower() or "door" in (from_node.get("name") or "").lower()
                    to_is_entrance = to_node.get("node_type") == "entrance" or "entrance" in (to_node.get("name") or "").lower() or "door" in (to_node.get("name") or "").lower()

                    if not (from_is_entrance or to_is_entrance):
                        if segment_crosses_any_wall(x1, y1, x2, y2, rooms, doorways_data=[]):
                            return jsonify({"error": "Path cannot cross walls directly. Enter or exit rooms only through an Entrance node."}), 400
                    else:
                        if segment_crosses_any_wall(x1, y1, x2, y2, rooms, doorways):
                            return jsonify({"error": "This path crosses a wall without a valid entrance opening"}), 400

        walkable = data.get("walkable", True)

        # Auto-compute distance via Haversine (GPS) or Euclidean scale (indoor/pixel)
        real_distance = 0.0
        if (from_node.get("latitude") is not None and to_node.get("latitude") is not None
                and from_node.get("longitude") is not None and to_node.get("longitude") is not None):
            real_distance = round(
                haversine_distance(
                    from_node["latitude"], from_node["longitude"],
                    to_node["latitude"], to_node["longitude"],
                ),
                2,
            )
        elif (from_node.get("x_coordinate") is not None and to_node.get("x_coordinate") is not None
              and from_node.get("y_coordinate") is not None and to_node.get("y_coordinate") is not None):
            w = 1000.0
            h = 1000.0
            if fp_id:
                fp_obj = get_floor_plan_by_id(fp_id)
                if fp_obj:
                    w = float(fp_obj.get("width_px") or 1000.0)
                    h = float(fp_obj.get("height_px") or 1000.0)
            x1 = float(from_node["x_coordinate"])
            y1 = float(from_node["y_coordinate"])
            x2 = float(to_node["x_coordinate"])
            y2 = float(to_node["y_coordinate"])
            dx = (x1 - x2) * w if x1 <= 1.0 and x2 <= 1.0 else (x1 - x2)
            dy = (y1 - y2) * h if y1 <= 1.0 and y2 <= 1.0 else (y1 - y2)
            real_distance = max(0.5, round(math.hypot(dx, dy) * 0.035, 2))

        edge = create_edge(
            from_node_id=data["from_node_id"],
            to_node_id=data["to_node_id"],
            distance=real_distance,
            walkable=walkable,
            edge_type=edge_type,
        )
        invalidate_room_route_cache()
        return jsonify({"data": edge}), 201

    except Exception as e:
        logging.error(f"Error creating edge: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


# ---------------------------------------------------------------------------
# Building Footprint
# ---------------------------------------------------------------------------

@map_bp.route("/floor-plans/<plan_id>/footprint", methods=["GET"])
def get_floor_plan_footprint_route(plan_id):
    try:
        footprint = get_footprint_by_floor_plan(plan_id)
        return jsonify({"data": footprint}), 200
    except Exception as e:
        logging.error(f"Error fetching floor plan footprint: {e}")
        return jsonify({"error": str(e)}), 500


@map_bp.route("/floor-plans/<plan_id>/footprint", methods=["POST", "PUT"])
def update_floor_plan_footprint_route(plan_id):
    try:
        data = request.get_json() or {}
        points = data.get("points", data if isinstance(data, list) else [])
        footprint = save_footprint(plan_id, points)
        if footprint is None:
            return jsonify({"error": "Floor plan not found"}), 404
        return jsonify({"data": footprint, "success": True}), 200
    except Exception as e:
        logging.error(f"Error saving floor plan footprint: {e}")
        return jsonify({"error": str(e)}), 500


@map_bp.route("/floor-plans/<plan_id>/validate", methods=["GET"])
@map_bp.route("/floor-plans/<plan_id>/validate-edges", methods=["GET"])
def validate_floor_plan_edges(plan_id):
    """Diagnostic endpoint checking all nodes and edges on a floor plan against footprint and room boundaries."""
    try:
        raw_nodes = get_all_nodes(floor_plan_id=plan_id)
        nodes = [n for n in (raw_nodes or []) if isinstance(n, dict)]
        nodes_dict = {str(n["id"]): n for n in nodes if n.get("id")}
        all_edges = [e for e in (get_all_edges() or []) if isinstance(e, dict)]

        fp_edges = []
        for e in all_edges:
            f_node = nodes_dict.get(str(e.get("from_node_id")))
            t_node = nodes_dict.get(str(e.get("to_node_id")))
            if f_node and t_node:
                fp_edges.append((e, f_node, t_node))

        rooms = get_rooms_by_floor_plan(plan_id) or []
        doorways = get_doorways_by_floor_plan(plan_id) or []
        footprint = get_footprint_by_floor_plan(plan_id)
        raw_pts = footprint.get("points", []) if isinstance(footprint, dict) else []
        fp_pts = [p for p in raw_pts if isinstance(p, dict)] if isinstance(raw_pts, list) else []
        footprint_defined = len(fp_pts) >= 3
        poly = [{"x": p["x"], "y": p["y"]} for p in fp_pts if "x" in p and "y" in p] if footprint_defined else []

        invalid_edges = []
        valid_count = 0

        for e, f_node, t_node in fp_edges:
            x1 = f_node.get("x_coordinate") if f_node.get("x_coordinate") is not None else f_node.get("longitude", 0)
            y1 = f_node.get("y_coordinate") if f_node.get("y_coordinate") is not None else f_node.get("latitude", 0)
            x2 = t_node.get("x_coordinate") if t_node.get("x_coordinate") is not None else t_node.get("longitude", 0)
            y2 = t_node.get("y_coordinate") if t_node.get("y_coordinate") is not None else t_node.get("latitude", 0)

            f_is_ent = f_node.get("node_type") == "entrance" or "entrance" in (f_node.get("name") or "").lower() or "door" in (f_node.get("name") or "").lower()
            t_is_ent = t_node.get("node_type") == "entrance" or "entrance" in (t_node.get("name") or "").lower() or "door" in (t_node.get("name") or "").lower()

            if not (f_is_ent or t_is_ent):
                if segment_crosses_any_wall(x1, y1, x2, y2, rooms, doorways_data=[]):
                    invalid_edges.append({
                        "edge_id": e.get("id"),
                        "from_node_id": e.get("from_node_id"),
                        "from_node_name": f_node.get("name", ""),
                        "to_node_id": e.get("to_node_id"),
                        "to_node_name": t_node.get("name", ""),
                        "reason": "Edge crosses room boundary without an Entrance node"
                    })
                    continue
            else:
                if segment_crosses_any_wall(x1, y1, x2, y2, rooms, doorways):
                    invalid_edges.append({
                        "edge_id": e.get("id"),
                        "from_node_id": e.get("from_node_id"),
                        "from_node_name": f_node.get("name", ""),
                        "to_node_id": e.get("to_node_id"),
                        "to_node_name": t_node.get("name", ""),
                        "reason": "Edge crosses room boundary without a marked doorway opening"
                    })
                    continue

            valid_count += 1

        out_of_boundary_nodes = []
        for n in nodes:
            nx = n.get("x_coordinate")
            ny = n.get("y_coordinate")
            if footprint_defined and nx is not None and ny is not None:
                if not point_in_polygon(nx, ny, poly):
                    out_of_boundary_nodes.append({
                        "node_id": str(n.get("id", "")),
                        "node_name": n.get("name", "Unnamed Node"),
                        "x": nx,
                        "y": ny,
                        "reason": f"Node '{n.get('name')}' position ({nx:.2f}, {ny:.2f}) falls outside the building footprint boundary"
                    })

        return jsonify({
            "floor_plan_id": plan_id,
            "footprint_defined": footprint_defined,
            "total_edges": len(fp_edges),
            "valid_edges_count": valid_count,
            "invalid_edges_count": len(invalid_edges),
            "invalid_edges": invalid_edges,
            "total_nodes": len(nodes),
            "valid_nodes_count": len(nodes) - len(out_of_boundary_nodes),
            "out_of_boundary_nodes_count": len(out_of_boundary_nodes),
            "out_of_boundary_nodes": out_of_boundary_nodes
        }), 200

    except Exception as e:
        logging.error(f"Error validating floor plan: {e}")
        return jsonify({"error": str(e)}), 500


@map_bp.route("/edges/<edge_id>", methods=["DELETE"])
def remove_edge(edge_id):
    try:
        success = delete_edge(edge_id)
        if success:
            invalidate_room_route_cache()
            return jsonify({"message": "Edge deleted"}), 200
        return jsonify({"error": "Edge not found"}), 404
    except Exception as e:
        logging.error(f"Error deleting edge: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


# ---------------------------------------------------------------------------
# Routing & Pathfinding
# ---------------------------------------------------------------------------

@map_bp.route("/route", methods=["GET"])
def get_route():
    try:
        from_id = request.args.get("from")
        to_id = request.args.get("to")

        if not from_id or not to_id:
            return jsonify({"error": "Missing 'from' or 'to' query parameters"}), 400

        from_node = get_node_by_id(from_id)
        to_node = get_node_by_id(to_id)

        if not from_node or not to_node:
            return jsonify({"error": "One or both nodes not found"}), 404

        nodes = get_all_nodes()
        nodes_dict = {str(n["id"]): n for n in nodes}
        edges = get_all_edges()

        path, total_distance, instructions = find_shortest_path(from_id, to_id, nodes_dict, edges)

        if not path:
            return jsonify({
                "message": "No walkable route exists between these nodes",
                "path": [],
                "distance": 0,
                "instructions": [],
            }), 200

        return jsonify({
            "path": path,
            "distance": total_distance,
            "instructions": instructions,
        }), 200

    except Exception as e:
        logging.error(f"Error finding route: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/route/full-room/<room_id>", methods=["POST"])
def route_full_room(room_id):
    """
    Solves optimal open-path TSP navigation through all must-visit nodes inside a room:
    entrance -> [ordered must-visit exhibits] -> exit.
    """
    try:
        body = request.get_json(silent=True) or {}
        force_refresh = bool(body.get("force_refresh", False))
        explicit_must_visit = body.get("must_visit_node_ids")

        result, error = calculate_full_room_route(
            room_id,
            force_refresh=force_refresh,
            explicit_must_visit_ids=explicit_must_visit
        )

        if error:
            status_code = 404 if "not found" in error.lower() else 400
            return jsonify({"error": error, "success": False}), status_code

        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error calculating full room route for {room_id}: {e}")
        return jsonify({"error": "Internal Server Error", "details": str(e), "success": False}), 500


@map_bp.route("/tour", methods=["GET"])
def get_full_tour():
    """Full-tour route: entrance → all artifacts → exit, floor-aware."""
    try:
        entrance_id = request.args.get("entrance")
        exit_id = request.args.get("exit")

        nodes = get_all_nodes()
        nodes_dict = {str(n["id"]): n for n in nodes}
        edges = get_all_edges()

        # If entrance_id not provided, auto-select first available entrance door node
        if not entrance_id:
            entrances = [
                n["id"] for n in nodes
                if "entrance" in [t.strip() for t in str(n.get("node_type", "")).split(",")]
            ]
            if entrances:
                entrance_id = entrances[0]
            else:
                return jsonify({"error": "No entrance node found"}), 400

        artifact_ids = [
            n["id"] for n in nodes
            if n["node_type"] in ("exhibit", "artifact") and n.get("latitude") is not None
        ]

        path, total_distance, instructions = plan_full_tour(
            entrance_id, exit_id, artifact_ids, nodes_dict, edges
        )

        if not path:
            return jsonify({"message": "No tour route found", "path": [], "distance": 0, "instructions": []}), 200

        return jsonify({
            "path": path,
            "distance": total_distance,
            "instructions": instructions,
        }), 200

    except Exception as e:
        logging.error(f"Error planning tour: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@map_bp.route("/nodes/nearby", methods=["GET"])
def get_nearby():
    try:
        node_id = request.args.get("node_id")
        hops = request.args.get("hops", type=int)
        radius = request.args.get("radius", type=float)

        if not node_id:
            return jsonify({"error": "Missing 'node_id' query parameter"}), 400

        if hops is None and radius is None:
            hops = 3

        nodes = get_all_nodes()
        nodes_dict = {str(n["id"]): n for n in nodes}
        edges = get_all_edges()

        nearby = get_nearby_nodes(node_id, radius_meters=radius, hops=hops, nodes_dict=nodes_dict, edges_list=edges)
        return jsonify({"data": nearby}), 200
    except Exception as e:
        logging.error(f"Error finding nearby nodes: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


# ---------------------------------------------------------------------------
# Full Offline Graph (consumed by mobile cache)
# ---------------------------------------------------------------------------

@map_bp.route("/graph", methods=["GET"])
def get_graph():
    """Returns the complete node graph for offline caching by the mobile app."""
    try:
        museum_id = request.args.get("museum_id")
        floor_plans = get_all_floor_plans(museum_id=museum_id)
        
        nodes = get_all_nodes()
        edges = get_all_edges()
        
        if museum_id:
            fp_ids = {str(fp["id"]) for fp in floor_plans}
            nodes = [n for n in nodes if str(n.get("floor_plan_id")) in fp_ids]
            node_ids = {str(n["id"]) for n in nodes}
            edges = [e for e in edges if str(e.get("from_node_id")) in node_ids and str(e.get("to_node_id")) in node_ids]

        return jsonify({
            "floor_plans": floor_plans,
            "nodes": nodes,
            "edges": edges,
        }), 200
    except Exception as e:
        logging.error(f"Error getting graph: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


# ---------------------------------------------------------------------------
# GeoJSON Graph
# ---------------------------------------------------------------------------

@map_bp.route("/geojson/floor/<floor>", methods=["GET"])
def get_geojson_floor(floor):
    """Returns a FeatureCollection of nodes, edges, and room boundaries for a given floor."""
    try:
        # Get nodes
        # Assuming floor can be cast to int for nodes, or passed as string
        try:
            floor_int = int(floor)
        except ValueError:
            floor_int = floor
            
        nodes = get_all_nodes(floor=floor_int)
        nodes_dict = {str(n["id"]): n for n in nodes}
        
        # Get edges
        all_edges = get_all_edges()
        
        # Filter edges where at least one node is on this floor
        floor_edges = []
        for e in all_edges:
            from_n = get_node_by_id(e["from_node_id"])
            to_n = get_node_by_id(e["to_node_id"])
            if from_n and to_n and (str(from_n.get("floor")) == str(floor) or str(to_n.get("floor")) == str(floor)):
                floor_edges.append((e, from_n, to_n))
                
        # Get galleries (rooms)
        galleries = get_galleries_by_floor(str(floor))
        
        features = []
        
        # Convert rooms
        for g in galleries:
            feat = to_geojson_polygon(g)
            if feat:
                features.append(feat)
                
        # Convert edges
        for e, from_n, to_n in floor_edges:
            feat = to_geojson_linestring(e, from_n, to_n)
            if feat:
                features.append(feat)
                
        # Convert nodes
        for n in nodes:
            feat = to_geojson_point(n)
            if feat:
                features.append(feat)
                
        return jsonify({
            "type": "FeatureCollection",
            "features": features
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting GeoJSON for floor {floor}: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------

@map_bp.route("/static/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    upload_dir = os.path.join(os.getcwd(), "uploads")
    return send_from_directory(upload_dir, filename)
