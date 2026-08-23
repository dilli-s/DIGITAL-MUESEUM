from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import Story, MuseumObject
from app.extensions import db

admin_stories_bp = Blueprint('admin_stories', __name__)

@admin_stories_bp.route('/stories', methods=['GET'])
@admin_required
def get_stories():
    try:
        object_id = request.args.get('object_id')
        query = Story.query
        
        if object_id:
            query = query.filter_by(object_id=object_id)
            
        stories = query.all()
        return jsonify({
            "data": [s.serialize() for s in stories]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch stories."}}), 500

@admin_stories_bp.route('/stories/<int:story_id>', methods=['GET'])
@admin_required
def get_story(story_id):
    try:
        story = Story.query.get(story_id)
        if not story:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Story not found."}}), 404
        return jsonify({
            "data": story.serialize()
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch story."}}), 500

@admin_stories_bp.route('/stories', methods=['POST'])
@admin_required
def create_story():
    try:
        data = request.json
        if not data or not data.get('title') or not data.get('object_id'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Title and object_id are required."}}), 400
            
        obj = MuseumObject.query.get(data['object_id'])
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object does not exist."}}), 404
            
        story = Story(
            title=data['title'],
            content=data.get('content'),
            object_id=data['object_id'],
            author=data.get('author'),
            theme=data.get('theme'),
            image_url=data.get('image_url')
        )
        db.session.add(story)
        db.session.commit()
        return jsonify({
            "data": story.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to create story."}}), 500

@admin_stories_bp.route('/stories/<int:story_id>', methods=['PATCH'])
@admin_required
def update_story(story_id):
    try:
        story = Story.query.get(story_id)
        if not story:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Story not found."}}), 404
            
        data = request.json
        
        if 'object_id' in data:
            obj = MuseumObject.query.get(data['object_id'])
            if not obj:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Object does not exist."}}), 404
                
        allowed_fields = ['title', 'content', 'object_id', 'author', 'theme', 'image_url']
        for field in allowed_fields:
            if field in data:
                setattr(story, field, data[field])
                
        db.session.commit()
        return jsonify({
            "data": story.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to update story."}}), 500

@admin_stories_bp.route('/stories/<int:story_id>', methods=['DELETE'])
@admin_required
def delete_story(story_id):
    try:
        story = Story.query.get(story_id)
        if not story:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Story not found."}}), 404
            
        db.session.delete(story)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to delete story."}}), 500
