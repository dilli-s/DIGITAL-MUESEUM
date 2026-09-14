from flask import Blueprint, jsonify, request
from app.services.recommendation_service import get_recommendations_for_user, get_recommendations_for_object
from flask_login import login_required, current_user

recommendations_bp = Blueprint('recommendations', __name__)

@recommendations_bp.route('/', methods=['GET'])
def get_recommendations():
    try:
        limit = request.args.get('limit', 10, type=int)
        if limit > 20: limit = 20

        object_id = request.args.get('object_id', type=int)
        if object_id:
            recommendations = get_recommendations_for_object(object_id, limit)
            if recommendations is None:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found."}}), 404
            return jsonify({"data": recommendations})

        if not current_user.is_authenticated:
            return jsonify({"error": {"code": "AUTH_REQUIRED", "message": "Login required for personalized recommendations."}}), 401
        
        recommendations = get_recommendations_for_user(current_user.id, limit)
        
        return jsonify({
            "data": recommendations
        })
    except Exception as e:
        print(f"Recommendation API Error: {e}")
        return jsonify({"error": {"code": "RECOMMENDATION_ERROR", "message": "Recommendations are temporarily unavailable."}}), 500
