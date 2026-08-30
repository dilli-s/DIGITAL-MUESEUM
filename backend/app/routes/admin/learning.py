from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import LearningResource, MuseumObject, Activity
from app.extensions import db

admin_learning_bp = Blueprint('admin_learning', __name__)

@admin_learning_bp.route('/learning', methods=['GET'])
@admin_required
def get_learning_resources():
    try:
        object_id = request.args.get('object_id')
        query = LearningResource.query
        
        if object_id:
            query = query.filter_by(object_id=object_id)
            
        resources = query.all()
        return jsonify({
            "data": [r.serialize() for r in resources]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch learning resources."}}), 500

@admin_learning_bp.route('/learning/<int:learning_id>', methods=['GET'])
@admin_required
def get_learning_resource(learning_id):
    try:
        resource = LearningResource.query.get(learning_id)
        if not resource:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Learning resource not found."}}), 404
        return jsonify({
            "data": resource.serialize()
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch learning resource."}}), 500

@admin_learning_bp.route('/learning', methods=['POST'])
@admin_required
def create_learning_resource():
    try:
        data = request.json
        if not data or not data.get('title') or not data.get('object_id'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Title and object_id are required."}}), 400
            
        obj = MuseumObject.query.get(data['object_id'])
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object does not exist."}}), 404
            
        resource = LearningResource(
            title=data['title'],
            description=data.get('description'),
            content=data.get('content'),
            object_id=data['object_id'],
            age_group=data.get('age_group'),
            difficulty_level=data.get('difficulty_level'),
            estimated_time=data.get('estimated_time'),
            cover_image=data.get('cover_image')
        )
        db.session.add(resource)
        db.session.commit()
        return jsonify({
            "data": resource.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to create learning resource."}}), 500

@admin_learning_bp.route('/learning/<int:learning_id>', methods=['PATCH'])
@admin_required
def update_learning_resource(learning_id):
    try:
        resource = LearningResource.query.get(learning_id)
        if not resource:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Learning resource not found."}}), 404
            
        data = request.json
        
        if 'object_id' in data:
            obj = MuseumObject.query.get(data['object_id'])
            if not obj:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Object does not exist."}}), 404
                
        allowed_fields = ['title', 'description', 'content', 'object_id', 'age_group', 'difficulty_level', 'estimated_time', 'cover_image']
        for field in allowed_fields:
            if field in data:
                setattr(resource, field, data[field])
                
        db.session.commit()
        return jsonify({
            "data": resource.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to update learning resource."}}), 500

@admin_learning_bp.route('/learning/<int:learning_id>', methods=['DELETE'])
@admin_required
def delete_learning_resource(learning_id):
    try:
        resource = LearningResource.query.get(learning_id)
        if not resource:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Learning resource not found."}}), 404
            
        # Removed artificial dependency check to allow cascade deletion
            
        db.session.delete(resource)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to delete learning resource."}}), 500
