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
            # Join with map_nodes and floor_plans to get rich metadata
            cur.execute("""
                SELECT q.id, q.floor_plan_id, q.node_id, q.qr_payload,
                       n.name as node_name, n.node_type, n.floor,
                       n.x_coordinate as x, n.y_coordinate as y, n.latitude, n.longitude,
                       fp.museum_id, fp.name as floor_plan_name
                FROM qr_locations q
                JOIN map_nodes n ON q.node_id = n.id
                LEFT JOIN floor_plans fp ON q.floor_plan_id = fp.id
                WHERE q.qr_payload = %s
            """, (payload,))
            res = cur.fetchone()
            if not res: return None
            data = dict(zip([desc[0] for desc in cur.description], res))
            
            # Determine qr_type
            payload_str = str(payload).lower()
            if "object" in payload_str or (data.get("node_type") or "") == "exhibit":
                data["qr_type"] = "exhibit"
            elif "museum" in payload_str and "room" not in payload_str:
                data["qr_type"] = "museum_entrance"
            elif "room" in payload_str or "door" in (data.get("node_name") or "").lower() or (data.get("node_type") or "") == "doorway":
                data["qr_type"] = "room_entrance"
            else:
                data["qr_type"] = "waypoint"
            return data
