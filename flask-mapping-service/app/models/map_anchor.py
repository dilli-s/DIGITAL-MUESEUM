import uuid
from app.utils.db import execute_query

def create_anchor(floor_plan_id, map_x, map_y, latitude, longitude):
    query = """
        INSERT INTO map_anchors (floor_plan_id, map_x, map_y, latitude, longitude)
        VALUES (%s::uuid, %s, %s, %s, %s)
        RETURNING id, floor_plan_id, map_x, map_y, latitude, longitude, created_at
    """
    row = execute_query(query, (floor_plan_id, map_x, map_y, latitude, longitude), fetchone=True, commit=True)
    if not row:
        return None
    return {
        "id": str(row[0]),
        "floor_plan_id": str(row[1]),
        "map_x": row[2],
        "map_y": row[3],
        "latitude": row[4],
        "longitude": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
    }

def get_anchors_for_floor_plan(floor_plan_id):
    query = """
        SELECT id, floor_plan_id, map_x, map_y, latitude, longitude, created_at
        FROM map_anchors
        WHERE floor_plan_id = %s::uuid
        ORDER BY created_at ASC
    """
    rows = execute_query(query, (floor_plan_id,), fetch=True)
    return [
        {
            "id": str(r[0]),
            "floor_plan_id": str(r[1]),
            "map_x": r[2],
            "map_y": r[3],
            "latitude": r[4],
            "longitude": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
        }
        for r in (rows or [])
    ]

def update_anchor(anchor_id, data):
    fields = []
    values = []
    for key in ['map_x', 'map_y', 'latitude', 'longitude']:
        if key in data:
            fields.append(f"{key} = %s")
            values.append(data[key])
    
    if not fields:
        return None
        
    values.append(anchor_id)
    query = f"""
        UPDATE map_anchors SET {', '.join(fields)} 
        WHERE id = %s::uuid 
        RETURNING id, floor_plan_id, map_x, map_y, latitude, longitude, created_at
    """
    row = execute_query(query, tuple(values), fetchone=True, commit=True)
    if not row:
        return None
    return {
        "id": str(row[0]),
        "floor_plan_id": str(row[1]),
        "map_x": row[2],
        "map_y": row[3],
        "latitude": row[4],
        "longitude": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
    }

def delete_anchor(anchor_id):
    query = "DELETE FROM map_anchors WHERE id = %s::uuid RETURNING id"
    row = execute_query(query, (anchor_id,), fetchone=True, commit=True)
    return row is not None
