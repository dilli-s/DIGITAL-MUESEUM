"""
Room and Doorway database models for floor plan boundary management.
"""
import logging

from app.utils.db import execute_query
from app.models.floor_plan import get_floor_plan_by_id
from app.utils.geo import map_xy_to_gps, gps_to_map_xy

def get_rooms_by_floor_plan(floor_plan_id):
    query = """
        SELECT id, floor_plan_id, name, room_type, walkable, created_at
        FROM rooms
        WHERE floor_plan_id = %s::uuid
        ORDER BY created_at ASC
    """
    rows = execute_query(query, (floor_plan_id,), fetch=True)
    if not rows:
        return []

    room_ids = [str(r[0]) for r in rows]

    # Batch fetch all boundaries in one query
    b_query = """
        SELECT room_id, id, corner_order, x, y, latitude, longitude, is_manually_corrected, corrected_at
        FROM room_boundaries
        WHERE room_id = ANY(%s::uuid[])
        ORDER BY room_id, corner_order ASC
    """
    b_rows = execute_query(b_query, (room_ids,), fetch=True) or []
    boundaries_by_room = {}
    for b in b_rows:
        rid = str(b[0])
        if rid not in boundaries_by_room:
            boundaries_by_room[rid] = []
        boundaries_by_room[rid].append({
            "id": str(b[1]),
            "corner_order": b[2],
            "x": b[3],
            "y": b[4],
            "latitude": b[5],
            "longitude": b[6],
            "is_manually_corrected": bool(b[7]),
            "corrected_at": b[8].isoformat() if b[8] else None
        })

    # Batch fetch all doorways in one query
    d_query = """
        SELECT room_id, id, x1, y1, x2, y2, connected_room_id, name
        FROM doorway_openings
        WHERE room_id = ANY(%s::uuid[])
    """
    d_rows = execute_query(d_query, (room_ids,), fetch=True) or []
    doorways_by_room = {}
    for d in d_rows:
        rid = str(d[0])
        if rid not in doorways_by_room:
            doorways_by_room[rid] = []
        doorways_by_room[rid].append({
            "id": str(d[1]),
            "x1": d[2],
            "y1": d[3],
            "x2": d[4],
            "y2": d[5],
            "connected_room_id": str(d[6]) if d[6] else None,
            "name": d[7]
        })

    rooms = []
    for r in rows:
        room_id = str(r[0])
        rooms.append({
            "id": room_id,
            "floor_plan_id": str(r[1]),
            "name": r[2],
            "room_type": r[3],
            "walkable": bool(r[4]),
            "created_at": r[5].isoformat() if r[5] else None,
            "boundaries": boundaries_by_room.get(room_id, []),
            "doorways": doorways_by_room.get(room_id, [])
        })

    return rooms

def get_doorways_by_floor_plan(floor_plan_id):
    query = """
        SELECT d.id, d.room_id, d.x1, d.y1, d.x2, d.y2, d.connected_room_id, d.name
        FROM doorway_openings d
        JOIN rooms r ON d.room_id = r.id
        WHERE r.floor_plan_id = %s::uuid
    """
    rows = execute_query(query, (floor_plan_id,), fetch=True)
    return [
        {
            "id": str(r[0]),
            "room_id": str(r[1]),
            "x1": r[2],
            "y1": r[3],
            "x2": r[4],
            "y2": r[5],
            "connected_room_id": str(r[6]) if r[6] else None,
            "name": r[7]
        }
        for r in (rows or [])
    ]

def create_room(floor_plan_id, name, room_type='gallery', walkable=True, boundary_points=None):
    query = """
        INSERT INTO rooms (floor_plan_id, name, room_type, walkable)
        VALUES (%s::uuid, %s, %s, %s)
        RETURNING id, floor_plan_id, name, room_type, walkable, created_at
    """
    row = execute_query(query, (floor_plan_id, name, room_type, walkable), fetchone=True, commit=True)
    if not row:
        return None

    room_id = str(row[0])
    plan = get_floor_plan_by_id(floor_plan_id)
    boundaries = []

    if boundary_points:
        for idx, pt in enumerate(boundary_points):
            x = float(pt.get('x', pt.get('lng', 0)))
            y = float(pt.get('y', pt.get('lat', 0)))
            
            lat = pt.get('lat', pt.get('latitude'))
            lng = pt.get('lng', pt.get('longitude'))
            is_manual = bool(pt.get('is_manually_corrected', False))
            
            if lat is None or lng is None:
                if plan:
                    derived_lat, derived_lng = map_xy_to_gps(x, y, plan)
                    lat = derived_lat
                    lng = derived_lng

            b_query = """
                INSERT INTO room_boundaries (room_id, corner_order, x, y, latitude, longitude, is_manually_corrected)
                VALUES (%s::uuid, %s, %s, %s, %s, %s, %s)
                RETURNING id, corner_order, x, y, latitude, longitude, is_manually_corrected, corrected_at
            """
            b_row = execute_query(b_query, (room_id, idx, x, y, lat, lng, is_manual), fetchone=True, commit=True)
            if b_row:
                boundaries.append({
                    "id": str(b_row[0]),
                    "corner_order": b_row[1],
                    "x": b_row[2],
                    "y": b_row[3],
                    "latitude": b_row[4],
                    "longitude": b_row[5],
                    "is_manually_corrected": bool(b_row[6]),
                    "corrected_at": b_row[7].isoformat() if b_row[7] else None
                })

    return {
        "id": room_id,
        "floor_plan_id": str(row[1]),
        "name": row[2],
        "room_type": row[3],
        "walkable": bool(row[4]),
        "created_at": row[5].isoformat() if row[5] else None,
        "boundaries": boundaries,
        "doorways": []
    }

def update_room(room_id, name=None, room_type=None, walkable=None, boundary_points=None):
    fields = []
    params = []

    if name is not None:
        fields.append("name = %s")
        params.append(name)
    if room_type is not None:
        fields.append("room_type = %s")
        params.append(room_type)
    if walkable is not None:
        fields.append("walkable = %s")
        params.append(walkable)

    if fields:
        params.append(room_id)
        query = f"UPDATE rooms SET {', '.join(fields)} WHERE id = %s::uuid"
        execute_query(query, tuple(params), commit=True)

    r_query = "SELECT id, floor_plan_id, name, room_type, walkable, created_at FROM rooms WHERE id = %s::uuid"
    row = execute_query(r_query, (room_id,), fetchone=True)
    if not row:
        return None

    floor_plan_id = str(row[1])
    plan = get_floor_plan_by_id(floor_plan_id)

    if boundary_points is not None:
        execute_query("DELETE FROM room_boundaries WHERE room_id = %s::uuid", (room_id,), commit=True)
        for idx, pt in enumerate(boundary_points):
            x = float(pt.get('x', pt.get('lng', 0)))
            y = float(pt.get('y', pt.get('lat', 0)))
            lat = pt.get('lat', pt.get('latitude'))
            lng = pt.get('lng', pt.get('longitude'))
            is_manual = bool(pt.get('is_manually_corrected', False))
            
            if lat is None or lng is None:
                if plan:
                    derived_lat, derived_lng = map_xy_to_gps(x, y, plan)
                    lat = derived_lat
                    lng = derived_lng

            b_query = """
                INSERT INTO room_boundaries (room_id, corner_order, x, y, latitude, longitude, is_manually_corrected)
                VALUES (%s::uuid, %s, %s, %s, %s, %s, %s)
            """
            execute_query(b_query, (room_id, idx, x, y, lat, lng, is_manual), commit=True)

    b_rows = execute_query("""
        SELECT id, corner_order, x, y, latitude, longitude, is_manually_corrected, corrected_at
        FROM room_boundaries WHERE room_id = %s::uuid ORDER BY corner_order ASC
    """, (room_id,), fetch=True)
    boundaries = [
        {
            "id": str(b[0]),
            "corner_order": b[1],
            "x": b[2],
            "y": b[3],
            "latitude": b[4],
            "longitude": b[5],
            "is_manually_corrected": bool(b[6]),
            "corrected_at": b[7].isoformat() if b[7] else None
        }
        for b in (b_rows or [])
    ]

    d_rows = execute_query("SELECT id, x1, y1, x2, y2, connected_room_id, name FROM doorway_openings WHERE room_id = %s::uuid", (room_id,), fetch=True)
    doorways = [
        {
            "id": str(d[0]),
            "x1": d[1],
            "y1": d[2],
            "x2": d[3],
            "y2": d[4],
            "connected_room_id": str(d[5]) if d[5] else None,
            "name": d[6]
        }
        for d in (d_rows or [])
    ]

    return {
        "id": str(row[0]),
        "floor_plan_id": floor_plan_id,
        "name": row[2],
        "room_type": row[3],
        "walkable": bool(row[4]),
        "created_at": row[5].isoformat() if row[5] else None,
        "boundaries": boundaries,
        "doorways": doorways
    }

def update_boundary_point(room_id, point_id, data):
    r_query = "SELECT id, floor_plan_id FROM rooms WHERE id = %s::uuid"
    r_row = execute_query(r_query, (room_id,), fetchone=True)
    if not r_row:
        return None, "Room not found", 404

    floor_plan_id = str(r_row[1])
    plan = get_floor_plan_by_id(floor_plan_id)
    if not plan:
        return None, "Floor plan not found", 404

    # Fetch boundary point
    b_query = """
        SELECT id, room_id, corner_order, x, y, latitude, longitude, is_manually_corrected, corrected_at
        FROM room_boundaries
        WHERE room_id = %s::uuid AND (id::text = %s OR corner_order::text = %s)
    """
    b_row = execute_query(b_query, (room_id, str(point_id), str(point_id)), fetchone=True)
    if not b_row:
        return None, "Boundary point not found", 404

    actual_point_id = str(b_row[0])
    is_revert = data.get("revert") is True or data.get("is_manually_corrected") is False

    if is_revert:
        curr_x = float(data.get("x", b_row[3]))
        curr_y = float(data.get("y", b_row[4]))
        derived_lat, derived_lng = map_xy_to_gps(curr_x, curr_y, plan)
        up_query = """
            UPDATE room_boundaries
            SET x = %s, y = %s, latitude = %s, longitude = %s,
                is_manually_corrected = FALSE, corrected_at = NULL
            WHERE id = %s::uuid
            RETURNING id, room_id, corner_order, x, y, latitude, longitude, is_manually_corrected, corrected_at
        """
        updated_row = execute_query(up_query, (curr_x, curr_y, derived_lat, derived_lng, actual_point_id), fetchone=True, commit=True)
    else:
        has_manual_gps = "latitude" in data and "longitude" in data
        if has_manual_gps:
            try:
                lat = float(data["latitude"])
                lng = float(data["longitude"])
            except (ValueError, TypeError):
                return None, "Invalid latitude or longitude values", 400

            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                return None, "Latitude must be -90 to 90 and Longitude must be -180 to 180", 400

            a1_lat = plan.get("anchor_1_lat")
            a1_lng = plan.get("anchor_1_lng")
            a2_lat = plan.get("anchor_2_lat")
            a2_lng = plan.get("anchor_2_lng")
            if a1_lat is None or a1_lng is None or a2_lat is None or a2_lng is None:
                return None, "Set anchors before manually correcting GPS coordinates.", 400

            new_x, new_y = gps_to_map_xy(lat, lng, plan)
            from app.models.footprint import validate_point_in_footprint
            is_valid, err_msg = validate_point_in_footprint(floor_plan_id, new_x, new_y)
            if not is_valid:
                return None, err_msg, 400

            up_query = """
                UPDATE room_boundaries
                SET x = %s, y = %s, latitude = %s, longitude = %s,
                    is_manually_corrected = TRUE, corrected_at = CURRENT_TIMESTAMP
                WHERE id = %s::uuid
                RETURNING id, room_id, corner_order, x, y, latitude, longitude, is_manually_corrected, corrected_at
            """
            updated_row = execute_query(up_query, (new_x, new_y, lat, lng, actual_point_id), fetchone=True, commit=True)
        elif "x" in data and "y" in data:
            new_x = float(data["x"])
            new_y = float(data["y"])
            from app.models.footprint import validate_point_in_footprint
            is_valid, err_msg = validate_point_in_footprint(floor_plan_id, new_x, new_y)
            if not is_valid:
                return None, err_msg, 400

            derived_lat, derived_lng = map_xy_to_gps(new_x, new_y, plan)
            up_query = """
                UPDATE room_boundaries
                SET x = %s, y = %s, latitude = %s, longitude = %s,
                    is_manually_corrected = FALSE, corrected_at = NULL
                WHERE id = %s::uuid
                RETURNING id, room_id, corner_order, x, y, latitude, longitude, is_manually_corrected, corrected_at
            """
            updated_row = execute_query(up_query, (new_x, new_y, derived_lat, derived_lng, actual_point_id), fetchone=True, commit=True)
        else:
            return None, "Must provide latitude/longitude or x/y coordinates", 400

    if not updated_row:
        return None, "Failed to update boundary point", 500

    pt_res = {
        "id": str(updated_row[0]),
        "room_id": str(updated_row[1]),
        "corner_order": updated_row[2],
        "x": updated_row[3],
        "y": updated_row[4],
        "latitude": updated_row[5],
        "longitude": updated_row[6],
        "is_manually_corrected": bool(updated_row[7]),
        "corrected_at": updated_row[8].isoformat() if updated_row[8] else None
    }
    return pt_res, None, 200

def delete_room(room_id):
    query = "DELETE FROM rooms WHERE id = %s::uuid RETURNING id"
    row = execute_query(query, (room_id,), fetchone=True, commit=True)
    return row is not None

def create_doorway(room_id, x1, y1, x2, y2, connected_room_id=None, name=None):
    query = """
        INSERT INTO doorway_openings (room_id, x1, y1, x2, y2, connected_room_id, name)
        VALUES (%s::uuid, %s, %s, %s, %s, %s::uuid, %s)
        RETURNING id, room_id, x1, y1, x2, y2, connected_room_id, name, created_at
    """
    row = execute_query(
        query,
        (room_id, x1, y1, x2, y2, connected_room_id if connected_room_id else None, name),
        fetchone=True,
        commit=True
    )

    # If a connected room is provided, also insert reciprocal doorway for the connected room
    if connected_room_id and str(connected_room_id) != str(room_id):
        try:
            execute_query(
                """
                INSERT INTO doorway_openings (room_id, x1, y1, x2, y2, connected_room_id, name)
                VALUES (%s::uuid, %s, %s, %s, %s, %s::uuid, %s)
                """,
                (connected_room_id, x1, y1, x2, y2, room_id, name),
                commit=True
            )
        except Exception as err:
            logging.warning(f"Could not create reciprocal doorway in connected room {connected_room_id}: {err}")

    if row:
        return {
            "id": str(row[0]),
            "room_id": str(row[1]),
            "x1": row[2],
            "y1": row[3],
            "x2": row[4],
            "y2": row[5],
            "connected_room_id": str(row[6]) if row[6] else None,
            "name": row[7],
            "created_at": row[8].isoformat() if row[8] else None
        }
    return None

def delete_doorway(doorway_id):
    # Fetch details before deleting to also delete any reciprocal doorway
    fetch_q = "SELECT room_id, connected_room_id, x1, y1, x2, y2 FROM doorway_openings WHERE id = %s::uuid"
    d_info = execute_query(fetch_q, (doorway_id,), fetchone=True)

    query = "DELETE FROM doorway_openings WHERE id = %s::uuid RETURNING id"
    row = execute_query(query, (doorway_id,), fetchone=True, commit=True)

    if d_info and d_info[1]:
        try:
            execute_query(
                """
                DELETE FROM doorway_openings 
                WHERE room_id = %s::uuid AND connected_room_id = %s::uuid
                  AND ABS(x1 - %s) < 0.001 AND ABS(y1 - %s) < 0.001
                """,
                (d_info[1], d_info[0], d_info[2], d_info[3]),
                commit=True
            )
        except Exception as r_err:
            logging.warning(f"Could not delete reciprocal doorway: {r_err}")

    return row is not None
