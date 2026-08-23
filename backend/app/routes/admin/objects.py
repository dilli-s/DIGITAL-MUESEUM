from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import MuseumObject, Museum, Gallery, Collection, Exhibition, LearningResource, Story
from app.extensions import db

admin_objects_bp = Blueprint('admin_objects', __name__)

@admin_objects_bp.route('/objects', methods=['GET'])
@admin_required
def get_objects():
    try:
        museum_id = request.args.get('museum_id')
        gallery_id = request.args.get('gallery_id')
        search = request.args.get('search', '').lower()
        
        query = MuseumObject.query
        
        if museum_id:
            query = query.filter_by(museum_id=museum_id)
        if gallery_id:
            query = query.filter_by(gallery_id=gallery_id)
        if search:
            query = query.filter(MuseumObject.title.ilike(f'%{search}%'))
            
        objects = query.limit(50).all()  # Simple pagination/limit
        return jsonify({
            "data": [obj.serialize() for obj in objects]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch objects."}}), 500

@admin_objects_bp.route('/objects/<int:object_id>', methods=['GET'])
@admin_required
def get_object(object_id):
    try:
        obj = MuseumObject.query.get(object_id)
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found."}}), 404
        return jsonify({
            "data": obj.serialize()
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch object."}}), 500

@admin_objects_bp.route('/objects', methods=['POST'])
@admin_required
def create_object():
    try:
        data = request.json
        if not data or not data.get('title') or not data.get('museum_id'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Title and museum_id are required."}}), 400
            
        museum = Museum.query.get(data['museum_id'])
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum does not exist."}}), 404
            
        obj = MuseumObject(
            title=data['title'],
            description=data.get('description'),
            museum_id=data['museum_id'],
            gallery_id=data.get('gallery_id'),
            collection_id=data.get('collection_id'),
            creator=data.get('creator'),
            creation_date=data.get('creation_date'),
            medium=data.get('medium'),
            dimensions=data.get('dimensions'),
            image_url=data.get('image_url'),
            model_3d_url=data.get('model_3d_url'),
            audio_url=data.get('audio_url')
        )
        db.session.add(obj)
        db.session.commit()
        return jsonify({
            "data": obj.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to create object."}}), 500

@admin_objects_bp.route('/objects/<int:object_id>', methods=['PATCH'])
@admin_required
def update_object(object_id):
    try:
        obj = MuseumObject.query.get(object_id)
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found."}}), 404
            
        data = request.json
                
        allowed_fields = [
            'title', 'description', 'museum_id', 'gallery_id', 'collection_id', 
            'creator', 'creation_date', 'medium', 'dimensions', 
            'image_url', 'model_3d_url', 'audio_url'
        ]
        
        for field in allowed_fields:
            if field in data:
                val = data[field]
                if val == '' and field in ['gallery_id', 'collection_id']:
                    val = None
                setattr(obj, field, val)
                
        db.session.commit()
        return jsonify({
            "data": obj.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to update object."}}), 500

@admin_objects_bp.route('/objects/<int:object_id>', methods=['DELETE'])
@admin_required
def delete_object(object_id):
    try:
        obj = MuseumObject.query.get(object_id)
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found."}}), 404
            
        # Check dependencies
        if LearningResource.query.filter_by(object_id=object_id).count() > 0 or \
           Story.query.filter_by(object_id=object_id).count() > 0:
            return jsonify({"error": {"code": "CONFLICT", "message": "Cannot delete object with associated learning resources or stories."}}), 409
            
        db.session.delete(obj)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to delete object."}}), 500
