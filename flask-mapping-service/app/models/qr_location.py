import uuid
from app.utils.db import get_db_connection

def create_qr_location(floor_plan_id, node_id, qr_payload):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO qr_locations (floor_plan_id, node_id, qr_payload)
                VALUES (%s, %s, %s)
                ON CONFLICT (qr_payload) DO UPDATE 
                SET floor_plan_id = EXCLUDED.floor_plan_id, node_id = EXCLUDED.node_id
                RETURNING id, floor_plan_id, node_id, qr_payload, created_at
            """, (floor_plan_id, node_id, qr_payload))
            res = cur.fetchone()
            conn.commit()
            return dict(zip([desc[0] for desc in cur.description], res)) if res else None

def get_qr_locations():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM qr_locations")
            cols = [desc[0] for desc in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]

def resolve_qr_payload(payload):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Join with map_nodes to get x, y
            cur.execute("""
                SELECT q.id, q.floor_plan_id, q.node_id, q.qr_payload, n.x_coordinate as x, n.y_coordinate as y, n.latitude, n.longitude
                FROM qr_locations q
                JOIN map_nodes n ON q.node_id = n.id
                WHERE q.qr_payload = %s
            """, (payload,))
            res = cur.fetchone()
            if not res: return None
            return dict(zip([desc[0] for desc in cur.description], res))
