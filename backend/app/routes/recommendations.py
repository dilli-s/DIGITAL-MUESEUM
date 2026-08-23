from flask import Blueprint, jsonify, request
from app.services.recommendation_service import get_recommendations_for_user
from flask_login import login_required, current_user

recommendations_bp = Blueprint('recommendations', __name__)

@recommendations_bp.route('/', methods=['GET'])
@login_required
def get_recommendations():
    try:
        limit = request.args.get('limit', 10, type=int)
        if limit > 20: limit = 20
        
        recommendations = get_recommendations_for_user(current_user.id, limit)
        
        return jsonify({
            "data": recommendations
        })
    except Exception as e:
        print(f"Recommendation API Error: {e}")
        return jsonify({"error": {"code": "RECOMMENDATION_ERROR", "message": "Recommendations are temporarily unavailable."}}), 500
