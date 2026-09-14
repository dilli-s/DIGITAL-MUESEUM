import uuid
from app.utils.db import execute_query

def _row_to_dict(row):
    if not row:
        return None
    return {
        "id": str(row[0]),
        "floor_plan_id": str(row[1]) if row[1] else None,
        "name": row[2],
        "description": row[3],
        "image_url": row[4],
        "map_x": float(row[5]) if row[5] is not None else 0.0,
        "map_y": float(row[6]) if row[6] is not None else 0.0,
        "latitude": float(row[7]) if row[7] is not None else None,
        "longitude": float(row[8]) if row[8] is not None else None,
        "created_at": row[9].isoformat() if row[9] else None,
    }

def create_artifact(data):
    query = """
        INSERT INTO artifacts (floor_plan_id, name, description, image_url, map_x, map_y, latitude, longitude)
        VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, floor_plan_id, name, description, image_url, map_x, map_y, latitude, longitude, created_at
    """
    params = (
        data['floor_plan_id'], data['name'], data.get('description'), 
        data.get('image_url'), data.get('map_x', 0.0), data.get('map_y', 0.0), 
        data.get('latitude'), data.get('longitude')
    )
    row = execute_query(query, params, fetchone=True, commit=True)
    return _row_to_dict(row)

def get_artifacts(floor_plan_id=None):
    query = "SELECT id, floor_plan_id, name, description, image_url, map_x, map_y, latitude, longitude, created_at FROM artifacts"
    params = ()
    if floor_plan_id:
        query += " WHERE floor_plan_id = %s::uuid"
        params = (floor_plan_id,)
    query += " ORDER BY name ASC"
    rows = execute_query(query, params, fetch=True)
    return [d for r in (rows or []) if (d := _row_to_dict(r)) is not None]

def get_artifact(artifact_id):
    query = "SELECT id, floor_plan_id, name, description, image_url, map_x, map_y, latitude, longitude, created_at FROM artifacts WHERE id = %s::uuid"
    row = execute_query(query, (artifact_id,), fetchone=True)
    return _row_to_dict(row)

def update_artifact(artifact_id, data):
    fields = []
    values = []
    for key in ['name', 'description', 'image_url', 'map_x', 'map_y', 'latitude', 'longitude']:
        if key in data:
            fields.append(f"{key} = %s")
            values.append(data[key])
            
    if not fields:
        return get_artifact(artifact_id)
    values.append(artifact_id)
    
    query = f"""
        UPDATE artifacts SET {', '.join(fields)} 
        WHERE id = %s::uuid 
        RETURNING id, floor_plan_id, name, description, image_url, map_x, map_y, latitude, longitude, created_at
    """
    row = execute_query(query, tuple(values), fetchone=True, commit=True)
    return _row_to_dict(row)

def delete_artifact(artifact_id):
    query = "DELETE FROM artifacts WHERE id = %s::uuid RETURNING id"
    row = execute_query(query, (artifact_id,), fetchone=True, commit=True)
    return row is not None
