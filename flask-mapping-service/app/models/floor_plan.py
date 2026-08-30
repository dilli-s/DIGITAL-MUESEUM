from app.utils.db import execute_query

def get_all_floor_plans():
    query = "SELECT id, name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor, created_at, anchor_1_x_px, anchor_1_y_px, anchor_1_lat, anchor_1_lng, anchor_2_x_px, anchor_2_y_px, anchor_2_lat, anchor_2_lng FROM floor_plans ORDER BY floor_number"
    rows = execute_query(query, fetch=True)
    
    return [
        {
            "id": str(row[0]),
            "name": row[1],
            "floor_number": row[2],
            "image_url": row[3],
            "width_px": row[4],
            "height_px": row[5],
            "scale_meters_per_px": row[6],
            "is_outdoor": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
            "anchor_1_x_px": row[9],
            "anchor_1_y_px": row[10],
            "anchor_1_lat": row[11],
            "anchor_1_lng": row[12],
            "anchor_2_x_px": row[13],
            "anchor_2_y_px": row[14],
            "anchor_2_lat": row[15],
            "anchor_2_lng": row[16]
        } for row in rows
    ] if rows else []

def get_floor_plan_by_id(plan_id):
    query = "SELECT id, name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor, created_at, anchor_1_x_px, anchor_1_y_px, anchor_1_lat, anchor_1_lng, anchor_2_x_px, anchor_2_y_px, anchor_2_lat, anchor_2_lng FROM floor_plans WHERE id = %s"
    row = execute_query(query, (plan_id,), fetchone=True)
    
    if row:
        return {
            "id": str(row[0]),
            "name": row[1],
            "floor_number": row[2],
            "image_url": row[3],
            "width_px": row[4],
            "height_px": row[5],
            "scale_meters_per_px": row[6],
            "is_outdoor": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
            "anchor_1_x_px": row[9],
            "anchor_1_y_px": row[10],
            "anchor_1_lat": row[11],
            "anchor_1_lng": row[12],
            "anchor_2_x_px": row[13],
            "anchor_2_y_px": row[14],
            "anchor_2_lat": row[15],
            "anchor_2_lng": row[16]
        }
    return None

def create_floor_plan(name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor):
    query = """
        INSERT INTO floor_plans (name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor) 
        VALUES (%s, %s, %s, %s, %s, %s, %s) 
        RETURNING id, name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor, created_at, anchor_1_x_px, anchor_1_y_px, anchor_1_lat, anchor_1_lng, anchor_2_x_px, anchor_2_y_px, anchor_2_lat, anchor_2_lng
    """
    row = execute_query(query, (name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor), fetchone=True, commit=True)
    
    if row:
        return {
            "id": str(row[0]),
            "name": row[1],
            "floor_number": row[2],
            "image_url": row[3],
            "width_px": row[4],
            "height_px": row[5],
            "scale_meters_per_px": row[6],
            "is_outdoor": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
            "anchor_1_x_px": row[9],
            "anchor_1_y_px": row[10],
            "anchor_1_lat": row[11],
            "anchor_1_lng": row[12],
            "anchor_2_x_px": row[13],
            "anchor_2_y_px": row[14],
            "anchor_2_lat": row[15],
            "anchor_2_lng": row[16]
        }
    return None

def update_floor_plan(plan_id, data):
    fields = []
    values = []
    
    valid_keys = [
        'name', 'floor_number', 'image_url', 'width_px', 'height_px', 
        'scale_meters_per_px', 'is_outdoor', 'anchor_1_x_px', 'anchor_1_y_px', 
        'anchor_1_lat', 'anchor_1_lng', 'anchor_2_x_px', 'anchor_2_y_px', 
        'anchor_2_lat', 'anchor_2_lng'
    ]
    
    for key, value in data.items():
        if key in valid_keys:
            fields.append(f"{key} = %s")
            values.append(value)
            
    if not fields:
        return get_floor_plan_by_id(plan_id)
        
    values.append(plan_id)
    query = f"UPDATE floor_plans SET {', '.join(fields)} WHERE id = %s RETURNING id, name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor, created_at, anchor_1_x_px, anchor_1_y_px, anchor_1_lat, anchor_1_lng, anchor_2_x_px, anchor_2_y_px, anchor_2_lat, anchor_2_lng"
    
    row = execute_query(query, tuple(values), fetchone=True, commit=True)
    
    if row:
        return {
            "id": str(row[0]),
            "name": row[1],
            "floor_number": row[2],
            "image_url": row[3],
            "width_px": row[4],
            "height_px": row[5],
            "scale_meters_per_px": row[6],
            "is_outdoor": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
            "anchor_1_x_px": row[9],
            "anchor_1_y_px": row[10],
            "anchor_1_lat": row[11],
            "anchor_1_lng": row[12],
            "anchor_2_x_px": row[13],
            "anchor_2_y_px": row[14],
            "anchor_2_lat": row[15],
            "anchor_2_lng": row[16]
        }
    return None

def delete_floor_plan(plan_id):
    query = "DELETE FROM floor_plans WHERE id = %s RETURNING id"
    row = execute_query(query, (plan_id,), fetchone=True, commit=True)
    return row is not None
