import uuid
from app.utils.db import get_db_connection

def create_artifact(data):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO artifacts (floor_plan_id, name, description, image_url, map_x, map_y, latitude, longitude)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, floor_plan_id, name, description, image_url, map_x, map_y, latitude, longitude, created_at
            """, (
                data['floor_plan_id'], data['name'], data.get('description'), 
                data.get('image_url'), data['map_x'], data['map_y'], 
                data.get('latitude'), data.get('longitude')
            ))
            res = cur.fetchone()
            conn.commit()
            return dict(zip([desc[0] for desc in cur.description], res)) if res else None
    finally:
        conn.close()

def get_artifacts(floor_plan_id=None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT id, floor_plan_id, name, description, image_url, map_x, map_y, latitude, longitude, created_at FROM artifacts"
            params = ()
            if floor_plan_id:
                query += " WHERE floor_plan_id = %s"
                params = (floor_plan_id,)
            cur.execute(query, params)
            cols = [desc[0] for desc in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()

def get_artifact(artifact_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM artifacts WHERE id = %s", (artifact_id,))
            res = cur.fetchone()
            if not res: return None
            return dict(zip([desc[0] for desc in cur.description], res))
    finally:
        conn.close()

def update_artifact(artifact_id, data):
    conn = get_db_connection()
    try:
        fields = []
        values = []
        for key in ['name', 'description', 'image_url', 'map_x', 'map_y', 'latitude', 'longitude']:
            if key in data:
                fields.append(f"{key} = %s")
                values.append(data[key])
                
        if not fields: return None
        values.append(artifact_id)
        
        query = f"UPDATE artifacts SET {', '.join(fields)} WHERE id = %s RETURNING *"
        with conn.cursor() as cur:
            cur.execute(query, tuple(values))
            res = cur.fetchone()
            conn.commit()
            return dict(zip([desc[0] for desc in cur.description], res)) if res else None
    finally:
        conn.close()

def delete_artifact(artifact_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM artifacts WHERE id = %s RETURNING id", (artifact_id,))
            res = cur.fetchone()
            conn.commit()
            return res is not None
    finally:
        conn.close()
