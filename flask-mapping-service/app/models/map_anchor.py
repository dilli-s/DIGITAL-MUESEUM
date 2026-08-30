import uuid
from app.utils.db import get_db_connection

def create_anchor(floor_plan_id, map_x, map_y, latitude, longitude):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO map_anchors (floor_plan_id, map_x, map_y, latitude, longitude)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, floor_plan_id, map_x, map_y, latitude, longitude, created_at
            """, (floor_plan_id, map_x, map_y, latitude, longitude))
            res = cur.fetchone()
            conn.commit()
            return dict(zip([desc[0] for desc in cur.description], res)) if res else None
    finally:
        conn.close()

def get_anchors_for_floor_plan(floor_plan_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, floor_plan_id, map_x, map_y, latitude, longitude, created_at
                FROM map_anchors
                WHERE floor_plan_id = %s
            """, (floor_plan_id,))
            cols = [desc[0] for desc in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()

def update_anchor(anchor_id, data):
    conn = get_db_connection()
    try:
        fields = []
        values = []
        for key in ['map_x', 'map_y', 'latitude', 'longitude']:
            if key in data:
                fields.append(f"{key} = %s")
                values.append(data[key])
        
        if not fields:
            return None
            
        values.append(anchor_id)
        query = f"UPDATE map_anchors SET {', '.join(fields)} WHERE id = %s RETURNING id, floor_plan_id, map_x, map_y, latitude, longitude"
        
        with conn.cursor() as cur:
            cur.execute(query, tuple(values))
            res = cur.fetchone()
            conn.commit()
            return dict(zip([desc[0] for desc in cur.description], res)) if res else None
    finally:
        conn.close()

def delete_anchor(anchor_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM map_anchors WHERE id = %s RETURNING id", (anchor_id,))
            res = cur.fetchone()
            conn.commit()
            return res is not None
    finally:
        conn.close()
