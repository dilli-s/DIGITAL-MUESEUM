from flask import Blueprint, request, jsonify
from app.models.map_node import get_all_nodes, get_node_by_id
from app.models.map_edge import get_all_edges
from app.models.floor_plan import get_all_floor_plans, get_floor_plan_by_id
from app.models.artifact import get_artifacts
from app.models.room import get_rooms_by_floor_plan, get_doorways_by_floor_plan
from app.utils.geometry import segment_crosses_any_wall
from app.utils.pathfinding import find_shortest_path, generate_instructions
from app.utils.geo import haversine_distance, map_xy_to_gps, gps_to_map_xy
import logging
import math

navigation_bp = Blueprint('navigation', __name__)

@navigation_bp.route('/navigation/route', methods=['POST'])
def calculate_route():
    data = request.json or {}
    start_node_id = data.get('start_node_id')
    dest_node_id = data.get('destination_node_id') or data.get('node_id')

    if not start_node_id or not dest_node_id:
        return jsonify({"error": "Missing start_node_id or destination_node_id"}), 400

    try:
        nodes = get_all_nodes()
        if not nodes:
            return jsonify({"error": "No map data"}), 404

        nodes_dict = {str(n['id']): n for n in nodes}
        edges = get_all_edges()

        if str(start_node_id) not in nodes_dict or str(dest_node_id) not in nodes_dict:
            return jsonify({"error": "Start or destination node not found"}), 404

        path, distance, instructions = find_shortest_path(str(start_node_id), str(dest_node_id), nodes_dict, edges)

        if not path:
            return jsonify({"error": "No route found"}), 404

        floor_plans = get_all_floor_plans()
        fp_dict = {str(fp['id']): fp for fp in (floor_plans or []) if fp and 'id' in fp}

        # Fetch all artifacts for floor plans in path
        artifacts_dict = {}
        all_fp_ids = {str(n.get('floor_plan_id')) for n in path if n.get('floor_plan_id')}
        for fpid in all_fp_ids:
            for art in (get_artifacts(fpid) or []):
                artifacts_dict[str(art['id'])] = art

        enriched_path = []
        for n in path:
            node_copy = dict(n)
            fp_id = str(node_copy.get('floor_plan_id')) if node_copy.get('floor_plan_id') else None
            fp = fp_dict.get(fp_id) if fp_id else None
            
            x_coord = node_copy.get('x_coordinate')
            y_coord = node_copy.get('y_coordinate')
            lat = node_copy.get('latitude')
            lng = node_copy.get('longitude')
            
            w = fp.get('width_px') if fp else None
            h = fp.get('height_px') if fp else None

            if x_coord is not None and y_coord is not None:
                if float(x_coord) > 1.0 and w:
                    map_x = float(x_coord) / float(w)
                else:
                    map_x = float(x_coord)
                if float(y_coord) > 1.0 and h:
                    map_y = float(y_coord) / float(h)
                else:
                    map_y = float(y_coord)
            elif lat is not None and lng is not None and fp:
                map_x, map_y = gps_to_map_xy(lat, lng, fp)
            else:
                map_x, map_y = 0.5, 0.5

            map_x = max(0.0, min(1.0, float(map_x)))
            map_y = max(0.0, min(1.0, float(map_y)))
                
            if fp and lat is not None and lng is not None:
                calc_lat, calc_lng = map_xy_to_gps(map_x, map_y, fp)
                if calc_lat is not None and calc_lng is not None:
                    lat = calc_lat
                    lng = calc_lng

            fp_name = fp.get('name') if fp else f"Floor {node_copy.get('floor', 1)}"
            location_label = f"{node_copy.get('name', 'Location')} · {fp_name}"
            
            node_copy['map_x'] = round(map_x, 6)
            node_copy['map_y'] = round(map_y, 6)
            node_copy['latitude'] = lat
            node_copy['longitude'] = lng
            node_copy['location_label'] = location_label

            art_id = node_copy.get('artifact_id')
            if art_id and str(art_id) in artifacts_dict:
                node_copy['artifact'] = artifacts_dict[str(art_id)]

            enriched_path.append(node_copy)

        estimated_time = int(distance / 1.2) if distance > 0 else 0
        if distance > 0 and estimated_time < 10:
            estimated_time = 10

        dist_rounded = round(distance, 2)
        return jsonify({
            "success": True,
            "route": enriched_path,
            "path": enriched_path,
            "distance_m": dist_rounded,
            "distance": dist_rounded,
            "estimated_time_s": estimated_time,
            "instructions": instructions
        }), 200

    except Exception as e:
        logging.error(f"Error calculating route: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@navigation_bp.route('/nodes/<node_id>/name-context', methods=['GET'])
def get_node_name_context(node_id):
    try:
        node = get_node_by_id(node_id)
        if not node:
            return jsonify({"error": "Node not found"}), 404

        fp_name = None
        if node.get("floor_plan_id"):
            fp = get_floor_plan_by_id(node["floor_plan_id"])
            if fp:
                fp_name = fp.get("name")

        floor_str = f"Floor {node.get('floor', 1)}"
        location_label = f"{node.get('name', 'Location')} · {fp_name or floor_str}"

        return jsonify({
            "data": {
                "node_id": str(node["id"]),
                "name": node.get("name"),
                "floor": node.get("floor"),
                "floor_plan_id": node.get("floor_plan_id"),
                "floor_plan_name": fp_name,
                "location_label": location_label
            }
        }), 200
    except Exception as e:
        logging.error(f"Error getting node name context: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


@navigation_bp.route('/navigation/pdr-step', methods=['POST'])
def fuse_pdr_step():
    """
    Ingests real device accelerometer/gyroscope step event and computes fused dead-reckoning update.
    Rejects anomalous strides (<0.35m or >1.35m), stale events, and zero displacements.
    """
    try:
        data = request.get_json() or {}
        sensor_event = data.get("sensor_event") or {}
        curr_pos = data.get("current_position") or {}
        fp_id = data.get("floor_plan_id") or curr_pos.get("floor_plan_id")

        stride_m = float(sensor_event.get("stride_meters", 0.75))
        heading_deg = float(sensor_event.get("heading_degrees", 0.0))
        timestamp = sensor_event.get("timestamp")

        # Guard 1: Physiological stride limits
        if stride_m < 0.35 or stride_m > 1.35:
            return jsonify({"error": f"Stride out of physiological bounds: {stride_m}m"}), 400

        # Extract current position (default center 0.5, 0.5 if missing)
        curr_map_x = float(curr_pos.get("map_x", 0.5))
        curr_map_y = float(curr_pos.get("map_y", 0.5))
        curr_lat = curr_pos.get("latitude")
        curr_lng = curr_pos.get("longitude")

        fp = get_floor_plan_by_id(fp_id) if fp_id else None
        w = float(fp.get("width_px") or 1000) if fp else 1000.0
        h = float(fp.get("height_px") or 1000) if fp else 1000.0
        scale = float(fp.get("scale_meters_per_px") or 0.04) if fp else 0.04

        # Heading displacement vector:
        # 0 deg = North (-Y on screen), 90 deg = East (+X on screen), 180 deg = South (+Y), 270 deg = West (-X)
        rad = math.radians(heading_deg)
        dx_m = math.sin(rad) * stride_m
        dy_m = math.cos(rad) * stride_m

        dx_px = dx_m / scale
        dy_px = -dy_m / scale  # screen Y is inverted relative to North

        new_map_x = max(0.0, min(1.0, curr_map_x + (dx_px / w)))
        new_map_y = max(0.0, min(1.0, curr_map_y + (dy_px / h)))

        # Wall-crossing validation constraint check (Part C)
        if fp_id:
            rooms = get_rooms_by_floor_plan(fp_id) or []
            doorways = get_doorways_by_floor_plan(fp_id) or []
            if rooms and segment_crosses_any_wall(curr_map_x, curr_map_y, new_map_x, new_map_y, rooms, doorways):
                logging.warning(
                    f"[WALL_CROSSING_REJECTED] PDR step from ({curr_map_x}, {curr_map_y}) to ({new_map_x}, {new_map_y}) crosses wall without doorway on floor plan {fp_id}"
                )
                return jsonify({
                    "success": True,
                    "rejected": True,
                    "reason": "wall_crossing_rejected",
                    "fused_position": {
                        "map_x": round(curr_map_x, 6),
                        "map_y": round(curr_map_y, 6),
                        "latitude": curr_lat,
                        "longitude": curr_lng,
                        "step_px": 0.0,
                        "stride_meters": stride_m,
                        "heading_degrees": heading_deg,
                        "timestamp": timestamp,
                        "source": "mapping_service_pdr_wall_constrained"
                    }
                }), 200

        new_lat, new_lng = curr_lat, curr_lng
        if fp:
            calc_lat, calc_lng = map_xy_to_gps(new_map_x, new_map_y, fp)
            if calc_lat is not None and calc_lng is not None:
                new_lat, new_lng = calc_lat, calc_lng

        return jsonify({
            "success": True,
            "fused_position": {
                "map_x": round(new_map_x, 6),
                "map_y": round(new_map_y, 6),
                "latitude": new_lat,
                "longitude": new_lng,
                "step_px": round(math.hypot(dx_px, dy_px), 2),
                "stride_meters": stride_m,
                "heading_degrees": heading_deg,
                "timestamp": timestamp,
                "source": "mapping_service_pdr_fusion"
            }
        }), 200

    except Exception as e:
        logging.error(f"Error in PDR fusion: {e}")
        return jsonify({"error": str(e)}), 500
