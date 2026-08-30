from flask import Blueprint, jsonify
from app.utils.db import get_db_connection
import logging

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Check if the service is running and the database pool is accessible.
    """
    db_status = "ok"
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        db_status = "error"
        
    status_code = 200 if db_status == "ok" else 503
    
    return jsonify({
        "status": "ok",
        "database": db_status
    }), status_code
