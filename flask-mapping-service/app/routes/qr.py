from flask import Blueprint, request, jsonify
from app.models.qr_location import create_qr_location, get_qr_locations, resolve_qr_payload
import logging

qr_bp = Blueprint('qr', __name__)

@qr_bp.route('/qr-locations', methods=['POST'])
def add_qr():
    data = request.json
    try:
        qr = create_qr_location(data['floor_plan_id'], data['node_id'], data['qr_payload'])
        return jsonify({"data": qr}), 201
    except Exception as e:
        logging.error(f"Error adding qr: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@qr_bp.route('/qr-locations', methods=['GET'])
def list_qrs():
    try:
        qrs = get_qr_locations()
        return jsonify({"data": qrs}), 200
    except Exception as e:
        logging.error(f"Error fetching qr locations: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@qr_bp.route('/qr-locations/<payload>', methods=['GET'])
def resolve_qr(payload):
    try:
        res = resolve_qr_payload(payload)
        if not res:
            return jsonify({"error": "Not found"}), 404
        return jsonify({"data": res}), 200
    except Exception as e:
        logging.error(f"Error resolving qr: {e}")
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500
