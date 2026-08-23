from flask import Blueprint, jsonify, request
from app.models.activity_progress import ActivityProgress
from app.models.activity import Activity
from app.models.history import UserHistory
from app.extensions import db
from flask_login import login_required, current_user
from datetime import datetime, timezone

activities_progress_bp = Blueprint('activities_progress', __name__)

@activities_progress_bp.route('/<int:activity_id>/progress', methods=['GET'])
@login_required
def get_activity_progress(activity_id):
    try:
        progress = ActivityProgress.query.filter_by(
            user_id=current_user.id,
            activity_id=activity_id
        ).first()

        if not progress:
            return jsonify({"data": {"status": "not_started", "completed": False}})

        return jsonify({"data": progress.serialize()})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@activities_progress_bp.route('/<int:activity_id>/complete', methods=['POST'])
@login_required
def complete_activity(activity_id):
    try:
        data = request.get_json()
        
        # Validate activity ID
        activity = db.session.get(Activity, activity_id)
        if not activity:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Activity not found"}}), 404

        progress = ActivityProgress.query.filter_by(
            user_id=current_user.id,
            activity_id=activity_id
        ).first()

        if not progress:
            progress = ActivityProgress(
                user_id=current_user.id,
                activity_id=activity_id,
            )
            db.session.add(progress)

        progress.status = 'completed'
        progress.completed = True
        if not progress.completed_at:
            progress.completed_at = datetime.now(timezone.utc)
            history = UserHistory(user_id=current_user.id, content_type='activity', content_id=activity_id, action='completed')
            db.session.add(history)
            
        # Optional: backend scoring if questions/answers exist
        # Since we don't have scoring logic defined explicitly yet, just record completion.

        db.session.commit()

        return jsonify({"data": progress.serialize()})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
