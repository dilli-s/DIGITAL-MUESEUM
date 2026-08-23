from flask import Blueprint, jsonify, request
from app.models.bookmark import Bookmark
from app.models.history import UserHistory
from app.extensions import db
from flask_login import login_required, current_user

bookmarks_bp = Blueprint('bookmarks', __name__)

@bookmarks_bp.route('/', methods=['GET'])
@login_required
def get_bookmarks():
    try:
        bookmarks = Bookmark.query.filter_by(user_id=current_user.id).all()
        return jsonify({
            "data": [b.serialize() for b in bookmarks]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@bookmarks_bp.route('/', methods=['POST'])
@login_required
def create_bookmark():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": {"code": "BAD_REQUEST", "message": "Invalid request"}}), 400

        content_type = data.get('content_type')
        content_id = data.get('content_id')

        if not content_type or not content_id:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "content_type and content_id are required"}}), 400

        # Note: We should ideally verify if the content actually exists in its respective table,
        # but for simplicity, we'll just store the bookmark.

        existing = Bookmark.query.filter_by(
            user_id=current_user.id,
            content_type=content_type,
            content_id=content_id
        ).first()

        if existing:
            return jsonify({"error": {"code": "CONFLICT", "message": "Bookmark already exists"}}), 409

        bookmark = Bookmark(
            user_id=current_user.id,
            content_type=content_type,
            content_id=content_id
        )
        db.session.add(bookmark)
        
        history = UserHistory(user_id=current_user.id, content_type=content_type, content_id=content_id, action='bookmarked')
        db.session.add(history)
        
        db.session.commit()

        return jsonify({"data": bookmark.serialize()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@bookmarks_bp.route('/<int:id>', methods=['DELETE'])
@login_required
def delete_bookmark(id):
    try:
        bookmark = db.session.get(Bookmark, id)
        if not bookmark:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Bookmark not found"}}), 404

        if bookmark.user_id != current_user.id:
            return jsonify({"error": {"code": "FORBIDDEN", "message": "Not authorized to delete this bookmark"}}), 403

        db.session.delete(bookmark)
        db.session.commit()

        return jsonify({"data": {"message": "Bookmark deleted successfully"}}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
