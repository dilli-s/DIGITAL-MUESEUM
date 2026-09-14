import json
from app.utils.db import execute_query

def _row_to_dict(row):
    if not row:
        return None
    affine = row[18] if len(row) > 18 else None
    if isinstance(affine, str):
        try:
            affine = json.loads(affine)
        except Exception:
            pass

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
        "anchor_2_lng": row[16],
        "museum_id": str(row[17]) if row[17] else None,
        "affine_transform": affine
    }

_SELECT_COLS = (
    "id, name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor, "
    "created_at, anchor_1_x_px, anchor_1_y_px, anchor_1_lat, anchor_1_lng, "
    "anchor_2_x_px, anchor_2_y_px, anchor_2_lat, anchor_2_lng, museum_id, affine_transform"
)

def get_all_floor_plans(museum_id=None) -> list[dict]:
    if museum_id:
        query = f"SELECT {_SELECT_COLS} FROM floor_plans WHERE museum_id = %s ORDER BY floor_number"
        rows = execute_query(query, (museum_id,), fetch=True)
    else:
        query = f"SELECT {_SELECT_COLS} FROM floor_plans ORDER BY floor_number"
        rows = execute_query(query, fetch=True)
    
    if not rows:
        return []
    return [d for r in rows if (d := _row_to_dict(r)) is not None]

def get_floor_plan_by_id(plan_id):
    query = f"SELECT {_SELECT_COLS} FROM floor_plans WHERE id = %s::uuid"
    row = execute_query(query, (plan_id,), fetchone=True)
    return _row_to_dict(row)

def create_floor_plan(name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor, museum_id=None, affine_transform=None):
    affine_val = json.dumps(affine_transform) if affine_transform and isinstance(affine_transform, dict) else affine_transform
    query = f"""
        INSERT INTO floor_plans (name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor, museum_id, affine_transform) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) 
        RETURNING {_SELECT_COLS}
    """
    row = execute_query(query, (name, floor_number, image_url, width_px, height_px, scale_meters_per_px, is_outdoor, museum_id, affine_val), fetchone=True, commit=True)
    return _row_to_dict(row)

def update_floor_plan(plan_id, data):
    fields = []
    values = []
    
    valid_keys = [
        'name', 'floor_number', 'image_url', 'width_px', 'height_px', 
        'scale_meters_per_px', 'is_outdoor', 'anchor_1_x_px', 'anchor_1_y_px', 
        'anchor_1_lat', 'anchor_1_lng', 'anchor_2_x_px', 'anchor_2_y_px', 
        'anchor_2_lat', 'anchor_2_lng', 'museum_id', 'affine_transform'
    ]
    
    for key, value in data.items():
        if key in valid_keys:
            fields.append(f"{key} = %s")
            if key == 'affine_transform' and isinstance(value, dict):
                values.append(json.dumps(value))
            else:
                values.append(value)
            
    if not fields:
        return get_floor_plan_by_id(plan_id)
        
    values.append(plan_id)
    query = f"UPDATE floor_plans SET {', '.join(fields)} WHERE id = %s::uuid RETURNING {_SELECT_COLS}"
    row = execute_query(query, tuple(values), fetchone=True, commit=True)
    return _row_to_dict(row)

def delete_floor_plan(plan_id):
    query = "DELETE FROM floor_plans WHERE id = %s::uuid RETURNING id"
    row = execute_query(query, (plan_id,), fetchone=True, commit=True)
    return row is not None
