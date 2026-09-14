import pytest
import uuid
from app import create_app
from app.utils.db import get_db_connection
from app.models.wifi_fingerprint import init_wifi_fingerprint_table, estimate_position

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_wifi_fingerprints_full_flow(client):
    floor_plan_id = str(uuid.uuid4())
    room_id = str(uuid.uuid4())

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Create dummy floor plan & room
            cur.execute("""
                INSERT INTO floor_plans (id, name, floor_number, width_px, height_px, is_outdoor)
                VALUES (%s, 'Test Floor WiFi', 1, 1000, 1000, FALSE)
            """, (floor_plan_id,))
            cur.execute("""
                INSERT INTO rooms (id, floor_plan_id, name, room_type, walkable)
                VALUES (%s, %s, 'Gallery Alpha', 'gallery', TRUE)
            """, (room_id, floor_plan_id))
            conn.commit()

    try:
        # 1. Check initial coverage (should be empty/sparse)
        res = client.get(f'/fingerprints/coverage/{room_id}')
        assert res.status_code == 200
        cov = res.get_json()
        assert cov['count'] == 0
        assert cov['is_sparse'] is True

        # 2. Capture Point A (x=0.2, y=0.3)
        res_cap1 = client.post('/fingerprints/capture', json={
            "room_id": room_id,
            "coordinate": {"x": 0.20, "y": 0.30},
            "readings": [
                {"bssid": "11:22:33:44:55:66", "rssi": -50},
                {"bssid": "aa:bb:cc:dd:ee:01", "rssi": -70},
                {"bssid": "aa:bb:cc:dd:ee:02", "rssi": -85}
            ]
        })
        assert res_cap1.status_code == 201
        fp1_id = res_cap1.get_json()['fingerprint']['id']

        # 3. Capture Point B (x=0.8, y=0.7)
        res_cap2 = client.post('/fingerprints/capture', json={
            "room_id": room_id,
            "x": 0.80,
            "y": 0.70,
            "readings": [
                {"bssid": "11:22:33:44:55:66", "rssi": -85},
                {"bssid": "aa:bb:cc:dd:ee:01", "rssi": -52},
                {"bssid": "aa:bb:cc:dd:ee:02", "rssi": -60}
            ]
        })
        assert res_cap2.status_code == 201

        # 4. Check coverage again (count=2 -> still sparse < 3)
        res_cov2 = client.get(f'/fingerprints/coverage/{room_id}')
        assert res_cov2.status_code == 200
        assert res_cov2.get_json()['count'] == 2
        assert res_cov2.get_json()['is_sparse'] is True

        # 5. Capture Point C (x=0.5, y=0.5) to reach good coverage
        res_cap3 = client.post('/fingerprints/capture', json={
            "room_id": room_id,
            "x": 0.50,
            "y": 0.50,
            "readings": [
                {"bssid": "11:22:33:44:55:66", "rssi": -65},
                {"bssid": "aa:bb:cc:dd:ee:01", "rssi": -62},
                {"bssid": "aa:bb:cc:dd:ee:02", "rssi": -72}
            ]
        })
        assert res_cap3.status_code == 201

        # 6. Check coverage again (count=3 -> not sparse)
        res_cov3 = client.get(f'/fingerprints/coverage/{room_id}')
        assert res_cov3.status_code == 200
        assert res_cov3.get_json()['count'] == 3
        assert res_cov3.get_json()['is_sparse'] is False

        # 7. Test live estimate near Point A
        res_est1 = client.post('/fingerprints/estimate', json={
            "room_id": room_id,
            "readings": [
                {"bssid": "11:22:33:44:55:66", "rssi": -51},
                {"bssid": "aa:bb:cc:dd:ee:01", "rssi": -71},
                {"bssid": "aa:bb:cc:dd:ee:02", "rssi": -84}
            ]
        })
        assert res_est1.status_code == 200
        est1 = res_est1.get_json()
        assert est1['status'] == 'ok'
        assert est1['confidence'] > 0.6
        assert abs(est1['coordinate']['x'] - 0.20) < 0.15
        assert abs(est1['coordinate']['y'] - 0.30) < 0.15

        # 8. Test live estimate near Point B
        res_est2 = client.post('/fingerprints/estimate', json={
            "room_id": room_id,
            "readings": [
                {"bssid": "11:22:33:44:55:66", "rssi": -86},
                {"bssid": "aa:bb:cc:dd:ee:01", "rssi": -51},
                {"bssid": "aa:bb:cc:dd:ee:02", "rssi": -59}
            ]
        })
        assert res_est2.status_code == 200
        est2 = res_est2.get_json()
        assert est2['status'] == 'ok'
        assert est2['confidence'] > 0.6
        assert abs(est2['coordinate']['x'] - 0.80) < 0.15
        assert abs(est2['coordinate']['y'] - 0.70) < 0.15

        # 9. Test low confidence / totally unknown BSSIDs
        res_est_low = client.post('/fingerprints/estimate', json={
            "room_id": room_id,
            "readings": [
                {"bssid": "99:99:99:99:99:99", "rssi": -90}
            ]
        })
        assert res_est_low.status_code == 200
        est_low = res_est_low.get_json()
        assert est_low['status'] == 'low_confidence'
        assert est_low['coordinate'] is None

        # 10. Delete a fingerprint
        res_del = client.delete(f'/fingerprints/{fp1_id}')
        assert res_del.status_code == 200

    finally:
        # Cleanup
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM floor_plans WHERE id = %s", (floor_plan_id,))
                    conn.commit()
        except Exception:
            pass

def test_non_uuid_room_id_rejection(client):
    # Non-UUID room_id (such as integer ID '14') should return 400 Bad Request
    res_cap = client.post('/fingerprints/capture', json={
        "room_id": "14",
        "coordinate": {"x": 0.5, "y": 0.5},
        "readings": [{"bssid": "11:22:33:44:55:66", "rssi": -60}]
    })
    assert res_cap.status_code == 400
    assert "Invalid room_id format" in res_cap.get_json()['error']

    res_cov = client.get('/fingerprints/coverage/14')
    assert res_cov.status_code == 400
    assert "Invalid room_id format" in res_cov.get_json()['error']

    res_room = client.get('/fingerprints/room/14')
    assert res_room.status_code == 400
    assert "Invalid room_id format" in res_room.get_json()['error']
