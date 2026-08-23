from flask import Blueprint, jsonify, request
from app.models.history import UserHistory
from app.extensions import db
from flask_login import login_required, current_user

history_bp = Blueprint('history', __name__)

@history_bp.route('/', methods=['GET'])
@login_required
def get_history():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Max 50 per page
        per_page = min(per_page, 50)

        pagination = UserHistory.query.filter_by(user_id=current_user.id)\
            .order_by(UserHistory.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)

        history = pagination.items

        return jsonify({
            "data": [h.serialize() for h in history],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total_pages": pagination.pages,
                "total_items": pagination.total
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@history_bp.route('/', methods=['POST'])
@login_required
def create_history_event():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": {"code": "BAD_REQUEST", "message": "Invalid request"}}), 400

        content_type = data.get('content_type')
        content_id = data.get('content_id')
        action = data.get('action')

        if not content_type or not content_id or not action:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "content_type, content_id, and action are required"}}), 400
            
        allowed_actions = ['viewed', 'started', 'completed', 'bookmarked']
        if action not in allowed_actions:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Invalid action"}}), 400

        event = UserHistory(
            user_id=current_user.id,
            content_type=content_type,
            content_id=content_id,
            action=action
        )
        db.session.add(event)
        db.session.commit()

        return jsonify({"data": event.serialize()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
