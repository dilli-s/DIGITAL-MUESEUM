from app.utils.db import execute_query

def get_all_nodes(floor_plan_id=None, floor=None):
    query = "SELECT id, name, floor, x_coordinate, y_coordinate, node_type, created_at, floor_plan_id, object_id, latitude, longitude FROM map_nodes"
    params = []
    
    conditions = []
    if floor_plan_id is not None:
        conditions.append("floor_plan_id = %s")
        params.append(floor_plan_id)
    if floor is not None:
        conditions.append("floor = %s")
        params.append(floor)
        
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
        
    query += " ORDER BY floor, name"
    
    rows = execute_query(query, params, fetch=True)
    
    return [
        {
            "id": str(row[0]),
            "name": row[1],
            "floor": row[2],
            "x_coordinate": row[3],
            "y_coordinate": row[4],
            "node_type": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
            "floor_plan_id": str(row[7]) if row[7] else None,
            "object_id": str(row[8]) if row[8] else None,
            "latitude": float(row[9]) if row[9] is not None else None,
            "longitude": float(row[10]) if row[10] is not None else None
        } for row in rows
    ] if rows else []

def get_node_by_id(node_id):
    query = "SELECT id, name, floor, x_coordinate, y_coordinate, node_type, created_at, floor_plan_id, object_id, latitude, longitude FROM map_nodes WHERE id = %s"
    row = execute_query(query, (node_id,), fetchone=True)
    
    if row:
        return {
            "id": str(row[0]),
            "name": row[1],
            "floor": row[2],
            "x_coordinate": row[3],
            "y_coordinate": row[4],
            "node_type": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
            "floor_plan_id": str(row[7]) if row[7] else None,
            "object_id": str(row[8]) if row[8] else None,
            "latitude": float(row[9]) if row[9] is not None else None,
            "longitude": float(row[10]) if row[10] is not None else None
        }
    return None

def create_node(name, floor, x, y, node_type, floor_plan_id=None, object_id=None, latitude=None, longitude=None):
    query = """
        INSERT INTO map_nodes (name, floor, x_coordinate, y_coordinate, node_type, floor_plan_id, object_id, latitude, longitude) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) 
        RETURNING id, name, floor, x_coordinate, y_coordinate, node_type, created_at, floor_plan_id, object_id, latitude, longitude
    """
    row = execute_query(query, (name, floor, x, y, node_type, floor_plan_id, object_id, latitude, longitude), fetchone=True, commit=True)
    
    if row:
        return {
            "id": str(row[0]),
            "name": row[1],
            "floor": row[2],
            "x_coordinate": row[3],
            "y_coordinate": row[4],
            "node_type": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
            "floor_plan_id": str(row[7]) if row[7] else None,
            "object_id": str(row[8]) if row[8] else None,
            "latitude": float(row[9]) if row[9] is not None else None,
            "longitude": float(row[10]) if row[10] is not None else None
        }
    return None

def update_node(node_id, data):
    fields = []
    values = []
    valid_keys = ['name', 'floor', 'x_coordinate', 'y_coordinate', 'node_type', 'floor_plan_id', 'object_id', 'latitude', 'longitude']
    
    for key, value in data.items():
        if key in valid_keys:
            fields.append(f"{key} = %s")
            values.append(value)
            
    if not fields:
        return get_node_by_id(node_id)
        
    values.append(node_id)
    query = f"UPDATE map_nodes SET {', '.join(fields)} WHERE id = %s RETURNING id, name, floor, x_coordinate, y_coordinate, node_type, created_at, floor_plan_id, object_id, latitude, longitude"
    
    row = execute_query(query, tuple(values), fetchone=True, commit=True)
    if row:
        return {
            "id": str(row[0]),
            "name": row[1],
            "floor": row[2],
            "x_coordinate": row[3],
            "y_coordinate": row[4],
            "node_type": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
            "floor_plan_id": str(row[7]) if row[7] else None,
            "object_id": str(row[8]) if row[8] else None,
            "latitude": float(row[9]) if row[9] is not None else None,
            "longitude": float(row[10]) if row[10] is not None else None
        }
    return None
