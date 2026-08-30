from flask import Blueprint, request, jsonify
from app.models.map_anchor import create_anchor, get_anchors_for_floor_plan, update_anchor, delete_anchor
import logging

anchors_bp = Blueprint('anchors', __name__)

@anchors_bp.route('/floor-plans/<plan_id>/anchors', methods=['POST'])
def add_anchor(plan_id):
    data = request.json
    try:
        anchor = create_anchor(plan_id, data['map_x'], data['map_y'], data['latitude'], data['longitude'])
        return jsonify({"data": anchor}), 201
    except Exception as e:
        logging.error(f"Error adding anchor: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@anchors_bp.route('/floor-plans/<plan_id>/anchors', methods=['GET'])
def get_anchors(plan_id):
    try:
        anchors = get_anchors_for_floor_plan(plan_id)
        return jsonify({"data": anchors}), 200
    except Exception as e:
        logging.error(f"Error fetching anchors: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@anchors_bp.route('/anchors/<anchor_id>', methods=['PUT'])
def edit_anchor(anchor_id):
    data = request.json
    try:
        anchor = update_anchor(anchor_id, data)
        if not anchor:
            return jsonify({"error": "Anchor not found or bad data"}), 404
        return jsonify({"data": anchor}), 200
    except Exception as e:
        logging.error(f"Error updating anchor: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@anchors_bp.route('/anchors/<anchor_id>', methods=['DELETE'])
def remove_anchor(anchor_id):
    try:
        success = delete_anchor(anchor_id)
        if not success:
            return jsonify({"error": "Anchor not found"}), 404
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.error(f"Error deleting anchor: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
