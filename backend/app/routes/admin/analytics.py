from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import User, Museum, Gallery, Collection, Exhibition, MuseumObject, LearningResource, Story, Activity, Bookmark, LearningProgress, ActivityProgress, UserHistory
from app.extensions import db
from sqlalchemy import func
from datetime import datetime, timedelta

admin_analytics_bp = Blueprint('admin_analytics', __name__)

def parse_dates(request):
    try:
        from_date_str = request.args.get('from')
        to_date_str = request.args.get('to')
        
        # Default to last 30 days if not provided
        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=30)
        
        if to_date_str:
            to_date = datetime.strptime(to_date_str, '%Y-%m-%d')
            # Set to end of day
            to_date = to_date.replace(hour=23, minute=59, second=59)
            
        if from_date_str:
            from_date = datetime.strptime(from_date_str, '%Y-%m-%d')
            
        if from_date > to_date:
            raise ValueError("From date cannot be after to date.")
            
        return from_date, to_date
    except ValueError as e:
        raise ValueError(str(e))

@admin_analytics_bp.route('/analytics/summary', methods=['GET'])
@admin_required
def get_analytics_summary():
    try:
        data = {
            "users": db.session.query(User).count(),
            "museums": db.session.query(Museum).count(),
            "objects": db.session.query(MuseumObject).count(),
            "exhibitions": db.session.query(Exhibition).count(),
            "learning_items": db.session.query(LearningResource).count(),
            "activities": db.session.query(Activity).count(),
            "bookmarks": db.session.query(Bookmark).count()
        }
        return jsonify({"data": data})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch summary."}}), 500

@admin_analytics_bp.route('/analytics/users', methods=['GET'])
@admin_required
def get_user_analytics():
    try:
        from_date, to_date = parse_dates(request)
        
        total_users = db.session.query(User).count()
        new_users = db.session.query(User).filter(User.created_at >= from_date, User.created_at <= to_date).count()
        
        # Define "active users" as users with some history in the date range
        active_users = db.session.query(UserHistory.user_id).filter(UserHistory.created_at >= from_date, UserHistory.created_at <= to_date).distinct().count()
        
        users_with_learning = db.session.query(LearningProgress.user_id).distinct().count()
        users_with_bookmarks = db.session.query(Bookmark.user_id).distinct().count()
        users_completing_activities = db.session.query(ActivityProgress.user_id).filter_by(is_completed=True).distinct().count()
        
        return jsonify({
            "data": {
                "total_users": total_users,
                "new_users": new_users,
                "active_users": active_users,
                "users_with_learning": users_with_learning,
                "users_with_bookmarks": users_with_bookmarks,
                "users_completing_activities": users_completing_activities
            }
        })
    except ValueError as e:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": str(e)}}), 400
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch user analytics."}}), 500

@admin_analytics_bp.route('/analytics/content', methods=['GET'])
@admin_required
def get_content_analytics():
    try:
        data = {
            "museums": db.session.query(Museum).count(),
            "galleries": db.session.query(Gallery).count(),
            "collections": db.session.query(Collection).count(),
            "exhibitions": db.session.query(Exhibition).count(),
            "objects": db.session.query(MuseumObject).count(),
            "learning": db.session.query(LearningResource).count(),
            "stories": db.session.query(Story).count(),
            "activities": db.session.query(Activity).count()
        }
        return jsonify({"data": data})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch content analytics."}}), 500

@admin_analytics_bp.route('/analytics/popular-content', methods=['GET'])
@admin_required
def get_popular_content():
    try:
        # Most viewed objects from history
        popular_history = db.session.query(
            UserHistory.content_id, func.count(UserHistory.id).label('views')
        ).filter(UserHistory.content_type == 'object').group_by(UserHistory.content_id).order_by(func.count(UserHistory.id).desc()).limit(10).all()
        
        popular_objects = []
        for content_id, views in popular_history:
            obj = MuseumObject.query.get(content_id)
            if obj:
                popular_objects.append({
                    "id": obj.id,
                    "title": obj.title,
                    "views": views,
                    "bookmarks": db.session.query(Bookmark).filter_by(content_type='object', content_id=obj.id).count()
                })
                
        return jsonify({"data": {"popular_objects": popular_objects}})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch popular content."}}), 500

@admin_analytics_bp.route('/analytics/bookmarks', methods=['GET'])
@admin_required
def get_bookmark_analytics():
    try:
        total_bookmarks = db.session.query(Bookmark).count()
        
        # Breakdown by type
        by_type = db.session.query(
            Bookmark.item_type, func.count(Bookmark.id)
        ).group_by(Bookmark.item_type).all()
        
        breakdown = {item_type: count for item_type, count in by_type}
        
        return jsonify({
            "data": {
                "total_bookmarks": total_bookmarks,
                "breakdown": breakdown
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch bookmark analytics."}}), 500

@admin_analytics_bp.route('/analytics/learning', methods=['GET'])
@admin_required
def get_learning_analytics():
    try:
        total_items = db.session.query(LearningResource).count()
        started = db.session.query(LearningProgress).count()
        completed = db.session.query(LearningProgress).filter_by(is_completed=True).count()
        
        completion_rate = (completed / started * 100) if started > 0 else 0
        
        return jsonify({
            "data": {
                "learning_items": total_items,
                "started_learning": started,
                "completed_learning": completed,
                "completion_rate": round(completion_rate, 2)
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch learning analytics."}}), 500

@admin_analytics_bp.route('/analytics/activities', methods=['GET'])
@admin_required
def get_activity_analytics():
    try:
        total_items = db.session.query(Activity).count()
        attempts = db.session.query(ActivityProgress).count()
        completed = db.session.query(ActivityProgress).filter_by(is_completed=True).count()
        
        completion_rate = (completed / attempts * 100) if attempts > 0 else 0
        
        return jsonify({
            "data": {
                "total_activities": total_items,
                "attempts": attempts,
                "completed_activities": completed,
                "completion_rate": round(completion_rate, 2)
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch activity analytics."}}), 500

@admin_analytics_bp.route('/analytics/trends', methods=['GET'])
@admin_required
def get_trends():
    try:
        from_date, to_date = parse_dates(request)
        
        # SQLite doesn't have a simple standard DATE() func that groups easily in SQLAlchemy cross-database out of the box with func.date, 
        # but func.date(UserHistory.created_at) works in SQLite. Neon (PostgreSQL) uses DATE(created_at).
        # We can fetch raw data or use generic casting. To avoid cross-DB issues, we fetch in range and group in Python.
        
        history_records = db.session.query(UserHistory.created_at).filter(UserHistory.created_at >= from_date, UserHistory.created_at <= to_date).all()
        
        trend_dict = {}
        for record in history_records:
            date_str = record[0].strftime('%Y-%m-%d')
            trend_dict[date_str] = trend_dict.get(date_str, 0) + 1
            
        # Format as list sorted by date
        sorted_dates = sorted(trend_dict.keys())
        data = [{"date": d, "views": trend_dict[d]} for d in sorted_dates]
        
        # Fill in missing dates if needed (optional, keeping it simple for now)
        
        return jsonify({"data": data})
    except ValueError as e:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": str(e)}}), 400
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch trends."}}), 500

@admin_analytics_bp.route('/analytics/ai', methods=['GET'])
@admin_required
def get_ai_analytics():
    # Since we don't have an AIRequest log model yet (Phase 18 used in-memory rate limiting and external APIs directly),
    # We will return dummy/empty data indicating we are starting to track, or what we can infer.
    # The prompt says: "Track only information that is actually available... If token usage exists: show token usage... Otherwise: do not invent cost."
    return jsonify({
        "data": {
            "message": "AI analytics tracking not yet backed by database models. Upgrade schema to record AI requests."
        }
    })

@admin_analytics_bp.route('/analytics/recommendations', methods=['GET'])
@admin_required
def get_recommendation_analytics():
    return jsonify({
        "data": {
            "message": "Recommendation interaction tracking not yet backed by database models."
        }
    })

@admin_analytics_bp.route('/analytics/api', methods=['GET'])
@admin_required
def get_api_analytics():
    # To be populated by monitoring foundation if added, or return 0 for now.
    return jsonify({
        "data": {
            "message": "API performance tracking not yet persistently stored."
        }
    })
