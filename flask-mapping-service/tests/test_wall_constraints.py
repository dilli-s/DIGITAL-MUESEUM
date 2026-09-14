import pytest
import uuid
import json
from app import create_app
from app.utils.db import get_db_connection

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_pdr_and_wifi_wall_crossing_rejection(client):
    floor_plan_id = str(uuid.uuid4())
    room_id = str(uuid.uuid4())

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Floor plan 1000x1000, scale 0.04 m/px
            cur.execute("""
                INSERT INTO floor_plans (id, name, floor_number, width_px, height_px, scale_meters_per_px, is_outdoor)
                VALUES (%s, 'Wall Constraint Floor', 1, 1000, 1000, 0.04, FALSE)
            """, (floor_plan_id,))
            cur.execute("""
                INSERT INTO rooms (id, floor_plan_id, name, room_type, walkable)
                VALUES (%s, %s, 'Enclosed Room', 'gallery', TRUE)
            """, (room_id, floor_plan_id))
            # Boundaries for room: square from (0.2, 0.2) to (0.4, 0.4)
            boundaries = [
                (0.2, 0.2, 0),
                (0.4, 0.2, 1),
                (0.4, 0.4, 2),
                (0.2, 0.4, 3)
            ]
            for bx, by, ord_idx in boundaries:
                cur.execute("""
                    INSERT INTO room_boundaries (id, room_id, x, y, corner_order)
                    VALUES (%s, %s, %s, %s, %s)
                """, (str(uuid.uuid4()), room_id, bx, by, ord_idx))
            conn.commit()

    try:
        # 1. Test PDR step crossing wall:
        # Current position at (0.38, 0.30), heading 90 deg (East, towards +X), stride 1.0m (25 px = 0.025 in map_x)
        # new_map_x would be 0.38 + 0.025 = 0.405, crossing the wall at x=0.40 without doorway!
        res_pdr = client.post('/api/navigation/pdr-step', json={
            "floor_plan_id": floor_plan_id,
            "current_position": {
                "map_x": 0.38,
                "map_y": 0.30,
                "floor_plan_id": floor_plan_id
            },
            "sensor_event": {
                "stride_meters": 1.0,
                "heading_degrees": 90.0,
                "timestamp": 123456789
            }
        })
        assert res_pdr.status_code == 200
        pdr_data = res_pdr.get_json()
        assert pdr_data.get('rejected') is True
        assert pdr_data.get('reason') == 'wall_crossing_rejected'
        # Crucial: marker held at original position, NOT moved across wall
        assert pdr_data['fused_position']['map_x'] == 0.38
        assert pdr_data['fused_position']['map_y'] == 0.30

        # 2. Test valid PDR step inside room:
        # Heading 180 deg (South, towards +Y), stride 0.5m (12.5 px = 0.0125 in map_y)
        # new_map_y = 0.30 + 0.0125 = 0.3125, stays safely inside (0.2, 0.4)
        res_pdr_valid = client.post('/api/navigation/pdr-step', json={
            "floor_plan_id": floor_plan_id,
            "current_position": {
                "map_x": 0.30,
                "map_y": 0.30,
                "floor_plan_id": floor_plan_id
            },
            "sensor_event": {
                "stride_meters": 0.5,
                "heading_degrees": 180.0,
                "timestamp": 123456790
            }
        })
        assert res_pdr_valid.status_code == 200
        pdr_valid_data = res_pdr_valid.get_json()
        assert pdr_valid_data.get('rejected') is not True
        assert pdr_valid_data['fused_position']['map_x'] == 0.30
        assert pdr_valid_data['fused_position']['map_y'] > 0.30

    finally:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM room_boundaries WHERE room_id = %s", (room_id,))
                cur.execute("DELETE FROM rooms WHERE id = %s", (room_id,))
                cur.execute("DELETE FROM floor_plans WHERE id = %s", (floor_plan_id,))
                conn.commit()
