import pytest
from app import create_app
from app.utils.db import get_db_connection
import uuid

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_qr_resolution(client):
    # Setup test data
    floor_plan_id = str(uuid.uuid4())
    node_id = str(uuid.uuid4())
    payload = "TEST_QR_PAYLOAD_123"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Insert dummy floor plan
            cur.execute("""
                INSERT INTO floor_plans (id, name, floor_number, width_px, height_px, is_outdoor)
                VALUES (%s, 'Test Floor', 1, 1000, 1000, FALSE)
            """, (floor_plan_id,))
            
            # Insert dummy node
            cur.execute("""
                INSERT INTO map_nodes (id, floor_plan_id, floor, x_coordinate, y_coordinate, node_type, name)
                VALUES (%s, %s, 1, 100, 100, 'waypoint', 'Test Node')
            """, (node_id, floor_plan_id))
            
            # Insert QR location
            cur.execute("""
                INSERT INTO qr_locations (floor_plan_id, node_id, qr_payload)
                VALUES (%s, %s, %s)
            """, (floor_plan_id, node_id, payload))
            conn.commit()

    try:
            
        # Test 1: Known payload returns 200
        res = client.get(f'/api/qr-locations/{payload}')
        assert res.status_code == 200
        data = res.get_json()
        assert 'data' in data
        assert data['data']['node_id'] == node_id
        assert data['data']['floor_plan_id'] == floor_plan_id
        assert data['data']['x'] == 100
        assert data['data']['y'] == 100
        
        # Test 2: Unknown payload returns 404
        res2 = client.get('/api/qr-locations/UNKNOWN_PAYLOAD_999')
        assert res2.status_code == 404
        
    finally:
        # Cleanup
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM floor_plans WHERE id = %s", (floor_plan_id,))
                    conn.commit()
        except Exception:
            pass
