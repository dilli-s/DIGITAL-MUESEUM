from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from app.extensions import db
from app.utils.decorators import admin_required
import platform
import os

admin_health_bp = Blueprint('admin_health', __name__)

@admin_health_bp.route('/health', methods=['GET'])
@admin_required
def get_admin_health():
    health = {
        "application": "healthy",
        "database": "unknown",
        "environment": "production" if os.getenv("FLASK_ENV") == "production" else "development",
        "system": {
            "python": platform.python_version(),
            "os": platform.system()
        },
        "ai_service": "configured" if os.getenv("GEMINI_API_KEY") else "missing_key"
    }
    
    # Check database
    try:
        db.session.execute(text('SELECT 1'))
        health["database"] = "connected"
    except Exception as e:
        health["database"] = "disconnected"
        health["application"] = "degraded"
        
    return jsonify({"data": health})
