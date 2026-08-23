from flask import Blueprint, jsonify, request
from app.models.learning_progress import LearningProgress
from app.models.learning import LearningResource
from app.models.history import UserHistory
from app.extensions import db
from flask_login import login_required, current_user
from datetime import datetime, timezone

progress_bp = Blueprint('progress', __name__)

@progress_bp.route('/learning/<int:learning_id>', methods=['GET'])
@login_required
def get_learning_progress(learning_id):
    try:
        progress = LearningProgress.query.filter_by(
            user_id=current_user.id,
            learning_id=learning_id
        ).first()

        if not progress:
            return jsonify({"data": {"progress": 0, "status": "not_started"}})

        return jsonify({"data": progress.serialize()})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@progress_bp.route('/learning/<int:learning_id>', methods=['POST', 'PATCH'])
@login_required
def update_learning_progress(learning_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": {"code": "BAD_REQUEST", "message": "Invalid request"}}), 400

        progress_val = data.get('progress')
        
        # Validate progress
        if progress_val is None or not isinstance(progress_val, (int, float)) or progress_val < 0 or progress_val > 100:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Progress must be a number between 0 and 100"}}), 400

        # Validate learning ID
        learning = db.session.get(LearningResource, learning_id)
        if not learning:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Learning resource not found"}}), 404

        progress = LearningProgress.query.filter_by(
            user_id=current_user.id,
            learning_id=learning_id
        ).first()

        if not progress:
            progress = LearningProgress(
                user_id=current_user.id,
                learning_id=learning_id,
            )
            db.session.add(progress)

        progress.progress = int(progress_val)
        
        if progress.progress == 0:
            progress.status = 'not_started'
            progress.completed_at = None
        elif progress.progress < 100:
            progress.status = 'in_progress'
            progress.completed_at = None
        else:
            progress.status = 'completed'
            if not progress.completed_at:
                progress.completed_at = datetime.now(timezone.utc)
                history = UserHistory(user_id=current_user.id, content_type='learning', content_id=learning_id, action='completed')
                db.session.add(history)

        db.session.commit()

        return jsonify({"data": progress.serialize()})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
