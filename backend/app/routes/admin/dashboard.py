from flask import Blueprint, jsonify
from app.utils.decorators import admin_required
from app.models import Museum, Gallery, Collection, Exhibition, MuseumObject, LearningResource, Story, Activity, User
from app.extensions import db

admin_dashboard_bp = Blueprint('admin_dashboard', __name__)

@admin_dashboard_bp.route('/dashboard', methods=['GET'])
@admin_required
def get_dashboard():
    try:
        data = {
            "museums": db.session.query(Museum).count(),
            "galleries": db.session.query(Gallery).count(),
            "collections": db.session.query(Collection).count(),
            "exhibitions": db.session.query(Exhibition).count(),
            "objects": db.session.query(MuseumObject).count(),
            "learning": db.session.query(LearningResource).count(),
            "stories": db.session.query(Story).count(),
            "activities": db.session.query(Activity).count(),
            "users": db.session.query(User).count()
        }
        
        return jsonify({
            "data": data
        })
    except Exception as e:
        print(f"Admin Dashboard Error: {e}")
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Could not fetch dashboard statistics."}}), 500
