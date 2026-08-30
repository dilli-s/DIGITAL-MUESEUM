import psycopg2
import uuid
from psycopg2.extras import RealDictCursor

DB_URL = "postgresql://neondb_owner:npg_J1yqQZ5nsodY@ep-snowy-grass-aymhkc3d.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"

def fix_and_seed_qr():
    conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
    try:
        cur = conn.cursor()
        
        # 1. Get map_nodes schema
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'map_nodes'")
        cols = [r['column_name'] for r in cur.fetchall()]
        print("map_nodes columns:", cols)

        # 2. Get all map_nodes
        cur.execute("SELECT * FROM map_nodes")
        nodes = cur.fetchall()
        
        # 3. Seed qr_locations
        # We need a floor_plan_id. If a node doesn't have one, we might need a default or we just skip it.
        # The prompt says: "write a script/endpoint to generate and store a qr_payload for every existing map_node that doesn't have one yet, and confirm via SELECT that rows now exist."
        # If node has no floor_plan_id, let's grab the first floor_plan_id available
        cur.execute("SELECT id FROM floor_plans LIMIT 1")
        default_floor_plan = cur.fetchone()
        
        for node in nodes:
            floor_plan_id = node.get('floor_plan_id')
            if not floor_plan_id and default_floor_plan:
                floor_plan_id = default_floor_plan['id']
                
            if not floor_plan_id:
                print(f"Skipping node {node['id']} - no floor_plan_id available")
                continue
                
            # format decided: string UUID without formatting wrapper
            qr_payload = str(node['id'])
            
            try:
                cur.execute("""
                    INSERT INTO qr_locations (floor_plan_id, node_id, qr_payload)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (qr_payload) DO NOTHING
                """, (floor_plan_id, node['id'], qr_payload))
                
                # Also ON CONFLICT (node_id)? There's no unique constraint on node_id in qr_locations, but maybe there should be.
            except Exception as e:
                print("Insert error:", e)
                conn.rollback()
            else:
                conn.commit()

        cur.execute("SELECT id, floor_plan_id, node_id, qr_payload FROM qr_locations")
        qrs = cur.fetchall()
        print("Seeded QR Locations:", qrs)
    finally:
        conn.close()

if __name__ == '__main__':
    fix_and_seed_qr()
