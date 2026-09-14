"""
Rooms Blueprint — Endpoints for room polygons and doorway openings.
"""
from flask import Blueprint, jsonify, request
import logging

from app.models.room import (
    get_rooms_by_floor_plan, create_room, update_room, delete_room,
    create_doorway, delete_doorway, get_doorways_by_floor_plan,
    update_boundary_point
)
from app.utils.room_routing import invalidate_room_route_cache

import time

rooms_bp = Blueprint("rooms", __name__)

_ROOMS_CACHE = {}
_CACHE_TTL = 300  # 5 minutes

def invalidate_rooms_cache():
    global _ROOMS_CACHE
    _ROOMS_CACHE.clear()

@rooms_bp.route("/floor-plans/<floor_plan_id>/rooms", methods=["GET"])
def list_rooms(floor_plan_id):
    try:
        now = time.time()
        cached = _ROOMS_CACHE.get(floor_plan_id)
        if cached and (now - cached['time']) < _CACHE_TTL:
            return jsonify({"data": cached['data']}), 200

        rooms = get_rooms_by_floor_plan(floor_plan_id)
        _ROOMS_CACHE[floor_plan_id] = {'time': now, 'data': rooms}
        return jsonify({"data": rooms}), 200
    except Exception as e:
        logging.error(f"Error listing rooms for floor plan {floor_plan_id}: {e}")
        return jsonify({"error": str(e)}), 500

@rooms_bp.route("/rooms", methods=["POST"])
def add_room():
    try:
        data = request.get_json()
        if not data or "floor_plan_id" not in data or "name" not in data:
            return jsonify({"error": "Missing required fields: floor_plan_id, name"}), 400

        boundaries = data.get("boundaries") or data.get("boundary_points") or []
        if len(boundaries) < 3:
            return jsonify({"error": "A room boundary polygon must have at least 3 corner points"}), 400

        room = create_room(
            floor_plan_id=data["floor_plan_id"],
            name=data["name"],
            room_type=data.get("room_type", "gallery"),
            walkable=data.get("walkable", True),
            boundary_points=boundaries
        )
        invalidate_rooms_cache()
        return jsonify({"data": room}), 201
    except Exception as e:
        logging.error(f"Error creating room: {e}")
        return jsonify({"error": str(e)}), 500

@rooms_bp.route("/rooms/<room_id>", methods=["PUT"])
def edit_room(room_id):
    try:
        data = request.get_json() or {}
        boundaries = data.get("boundaries") or data.get("boundary_points")
        if boundaries is not None and len(boundaries) < 3:
            return jsonify({"error": "A room boundary polygon must have at least 3 corner points"}), 400

        room = update_room(
            room_id=room_id,
            name=data.get("name"),
            room_type=data.get("room_type"),
            walkable=data.get("walkable"),
            boundary_points=boundaries
        )
        if not room:
            return jsonify({"error": "Room not found"}), 404
        invalidate_rooms_cache()
        invalidate_room_route_cache(room_id)
        return jsonify({"data": room}), 200
    except Exception as e:
        logging.error(f"Error updating room {room_id}: {e}")
        return jsonify({"error": str(e)}), 500

@rooms_bp.route("/rooms/<room_id>", methods=["DELETE"])
def remove_room(room_id):
    try:
        success = delete_room(room_id)
        if not success:
            return jsonify({"error": "Room not found"}), 404
        invalidate_rooms_cache()
        invalidate_room_route_cache(room_id)
        return jsonify({"message": "Room deleted successfully"}), 200
    except Exception as e:
        logging.error(f"Error deleting room {room_id}: {e}")
        return jsonify({"error": str(e)}), 500

@rooms_bp.route("/doorways", methods=["POST"])
def add_doorway():
    try:
        data = request.get_json()
        required = ["room_id", "x1", "y1", "x2", "y2"]
        if not data or not all(k in data for k in required):
            return jsonify({"error": "Missing required doorway fields: room_id, x1, y1, x2, y2"}), 400

        doorway = create_doorway(
            room_id=data["room_id"],
            x1=float(data["x1"]),
            y1=float(data["y1"]),
            x2=float(data["x2"]),
            y2=float(data["y2"]),
            connected_room_id=data.get("connected_room_id"),
            name=data.get("name")
        )
        invalidate_rooms_cache()
        invalidate_room_route_cache(data["room_id"])
        if data.get("connected_room_id"):
            invalidate_room_route_cache(data["connected_room_id"])
        return jsonify({"data": doorway}), 201
    except Exception as e:
        logging.error(f"Error creating doorway: {e}")
        return jsonify({"error": str(e)}), 500

@rooms_bp.route("/doorways/<doorway_id>", methods=["DELETE"])
def remove_doorway(doorway_id):
    try:
        success = delete_doorway(doorway_id)
        if not success:
            return jsonify({"error": "Doorway not found"}), 404
        invalidate_rooms_cache()
        invalidate_room_route_cache()
        return jsonify({"message": "Doorway deleted successfully"}), 200
    except Exception as e:
        logging.error(f"Error deleting doorway {doorway_id}: {e}")
        return jsonify({"error": str(e)}), 500

@rooms_bp.route("/rooms/<room_id>/boundary-points/<point_id>", methods=["PUT"])
def edit_boundary_point(room_id, point_id):
    try:
        data = request.get_json() or {}
        res, err, status_code = update_boundary_point(room_id, point_id, data)
        if err:
            return jsonify({"error": err}), status_code
        invalidate_room_route_cache(room_id)
        return jsonify({"data": res, "success": True}), status_code
    except Exception as e:
        logging.error(f"Error updating boundary point {point_id} for room {room_id}: {e}")
        return jsonify({"error": str(e)}), 500

