from flask import Blueprint, jsonify
from sqlalchemy import text
from app.extensions import db
import logging

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200

@health_bp.route('/health/db', methods=['GET'])
def db_health_check():
    try:
        # Minimal database query
        db.session.execute(text('SELECT 1'))
        return jsonify({
            "status": "ok",
            "database": "connected"
        }), 200
    except Exception as e:
        # Log the actual error, but don't expose it to the user
        logging.error(f"Database health check failed: {e}")
        return jsonify({
            "status": "error",
            "database": "unavailable"
        }), 500
