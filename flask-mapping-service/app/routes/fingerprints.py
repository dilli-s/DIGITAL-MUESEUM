import logging
import uuid
from flask import Blueprint, request, jsonify
from app.models.wifi_fingerprint import (
    create_fingerprint,
    get_fingerprints_by_room,
    get_room_coverage,
    estimate_position,
    delete_fingerprint,
    init_wifi_fingerprint_table
)
from app.models.room import get_rooms_by_floor_plan, get_doorways_by_floor_plan
from app.utils.geometry import segment_crosses_any_wall

logger = logging.getLogger(__name__)

fingerprints_bp = Blueprint('fingerprints', __name__)

_table_initialized = False

@fingerprints_bp.before_app_request
def setup_table_once():
    """Ensure table exists on first request if needed."""
    global _table_initialized
    if not _table_initialized:
        init_wifi_fingerprint_table()
        _table_initialized = True

@fingerprints_bp.route('/fingerprints/capture', methods=['POST'])
def capture_fingerprint():
    """
    POST /fingerprints/capture
    Payload:
    {
        "room_id": "<uuid>",
        "coordinate": {"x": 0.45, "y": 0.62}, // or directly "x": 0.45, "y": 0.62
        "readings": [
            {"bssid": "aa:bb:cc:dd:ee:ff", "rssi": -65},
            ...
        ]
    }
    """
    data = request.get_json() or {}
    room_id = data.get('room_id')
    if not room_id:
        return jsonify({"error": "room_id is required"}), 400
    try:
        uuid.UUID(str(room_id))
    except (ValueError, TypeError, AttributeError):
        return jsonify({"error": f"Invalid room_id format: '{room_id}' is not a valid UUID"}), 400

    # Parse coordinate
    x = data.get('x')
    y = data.get('y')
    if x is None or y is None:
        coord = data.get('coordinate')
        if isinstance(coord, dict):
            x = coord.get('x')
            y = coord.get('y')
        elif isinstance(coord, (list, tuple)) and len(coord) >= 2:
            x = coord[0]
            y = coord[1]

    if x is None or y is None:
        return jsonify({"error": "coordinate {x, y} is required"}), 400

    readings = data.get('readings', [])
    if not isinstance(readings, list):
        return jsonify({"error": "readings must be a list of {bssid, rssi} objects"}), 400

    try:
        record = create_fingerprint(room_id, x, y, readings)
        if not record:
            return jsonify({"error": "Failed to create fingerprint record"}), 500
        return jsonify({
            "message": "Fingerprint captured successfully",
            "fingerprint": record
        }), 201
    except Exception as e:
        logger.error(f"Error capturing fingerprint: {e}")
        return jsonify({"error": str(e)}), 500

@fingerprints_bp.route('/fingerprints/estimate', methods=['POST'])
def estimate_wifi_position():
    """
    POST /fingerprints/estimate
    Payload:
    {
        "room_id": "<uuid>",
        "readings": [
            {"bssid": "aa:bb:cc:dd:ee:ff", "rssi": -68},
            ...
        ],
        "k": 3 // optional
    }
    """
    data = request.get_json() or {}
    room_id = data.get('room_id')
    if not room_id:
        return jsonify({"error": "room_id is required"}), 400

    readings = data.get('readings', [])
    if not isinstance(readings, list) or len(readings) == 0:
        return jsonify({
            "status": "low_confidence",
            "coordinate": None,
            "confidence": 0.0,
            "message": "No live WiFi readings provided"
        }), 200

    k = data.get('k', 3)
    try:
        k = int(k)
    except (ValueError, TypeError):
        k = 3

    try:
        result = estimate_position(room_id, readings, k=k)

        # Wall-crossing validation constraint check (Part C)
        curr_pos = data.get('current_position') or {}
        curr_x = curr_pos.get('x') if curr_pos.get('x') is not None else curr_pos.get('map_x')
        curr_y = curr_pos.get('y') if curr_pos.get('y') is not None else curr_pos.get('map_y')
        fp_id = data.get('floor_plan_id') or curr_pos.get('floor_plan_id')

        if result.get('coordinate') and curr_x is not None and curr_y is not None and fp_id:
            cand_x = result['coordinate']['x']
            cand_y = result['coordinate']['y']
            rooms = get_rooms_by_floor_plan(fp_id) or []
            doorways = get_doorways_by_floor_plan(fp_id) or []
            if rooms and segment_crosses_any_wall(float(curr_x), float(curr_y), float(cand_x), float(cand_y), rooms, doorways):
                logger.warning(
                    f"[WALL_CROSSING_REJECTED] Candidate WiFi estimate ({cand_x}, {cand_y}) from ({curr_x}, {curr_y}) crosses wall without doorway on floor plan {fp_id}"
                )
                return jsonify({
                    "status": "wall_crossing_rejected",
                    "coordinate": None,
                    "confidence": 0.0,
                    "rejected": True,
                    "message": "Candidate WiFi coordinate crosses wall boundary without doorway"
                }), 200

        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error estimating position: {e}")
        return jsonify({"error": str(e)}), 500

@fingerprints_bp.route('/fingerprints/coverage/<room_id>', methods=['GET'])
def check_coverage(room_id):
    """
    GET /fingerprints/coverage/<room_id>
    Lightweight check reporting count of fingerprints and whether coverage is sparse.
    """
    try:
        uuid.UUID(str(room_id))
    except (ValueError, TypeError, AttributeError):
        return jsonify({"error": f"Invalid room_id format: '{room_id}' is not a valid UUID"}), 400
    try:
        coverage = get_room_coverage(room_id)
        return jsonify(coverage), 200
    except Exception as e:
        logger.error(f"Error checking coverage: {e}")
        return jsonify({"error": str(e)}), 500

@fingerprints_bp.route('/fingerprints/room/<room_id>', methods=['GET'])
def get_room_fingerprints(room_id):
    """
    GET /fingerprints/room/<room_id>
    List all surveyed fingerprints for a given room.
    """
    try:
        uuid.UUID(str(room_id))
    except (ValueError, TypeError, AttributeError):
        return jsonify({"error": f"Invalid room_id format: '{room_id}' is not a valid UUID"}), 400
    try:
        fingerprints = get_fingerprints_by_room(room_id)
        return jsonify(fingerprints), 200
    except Exception as e:
        logger.error(f"Error fetching room fingerprints: {e}")
        return jsonify({"error": str(e)}), 500

@fingerprints_bp.route('/fingerprints/<fingerprint_id>', methods=['DELETE'])
def delete_single_fingerprint(fingerprint_id):
    """
    DELETE /fingerprints/<fingerprint_id>
    """
    try:
        success = delete_fingerprint(fingerprint_id)
        if not success:
            return jsonify({"error": "Fingerprint not found"}), 404
        return jsonify({"message": "Fingerprint deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Error deleting fingerprint: {e}")
        return jsonify({"error": str(e)}), 500
