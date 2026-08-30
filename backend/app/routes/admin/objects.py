from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import MuseumObject, Museum, Gallery, Collection, Exhibition, LearningResource, Story
from app.extensions import db
from app.services.media_generator import trigger_media_generation

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
            query = query.filter(MuseumObject.name.ilike(f'%{search}%'))
            
        objects = query.limit(50).all()
        return jsonify({
            "data": [obj.serialize() for obj in objects]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

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
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

@admin_objects_bp.route('/objects', methods=['POST'])
@admin_required
def create_object():
    try:
        data = request.json
        # Support both 'name' and 'title' from frontend
        name = data.get('name') or data.get('title')
        if not data or not name or not data.get('museum_id'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Name/title and museum_id are required."}}), 400
            
        museum = Museum.query.get(data['museum_id'])
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum does not exist."}}), 404
            
        obj = MuseumObject(
            name=name,
            description=data.get('description'),
            museum_id=data['museum_id'],
            gallery_id=data.get('gallery_id') or None,
            collection_id=data.get('collection_id') or None,
            image=data.get('image_url') or data.get('image'),
            period=data.get('period'),
            origin=data.get('origin'),
            category=data.get('category'),
            latitude=data.get('latitude') or None,
            longitude=data.get('longitude') or None,
        )
        db.session.add(obj)
        db.session.commit()
        
        # Trigger background AI generation for 3D model and Audio if image is provided
        if obj.image:
            trigger_media_generation(obj.id, obj.image, obj.name, obj.description)
            
        return jsonify({
            "data": obj.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating object: {e}")
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

@admin_objects_bp.route('/objects/<int:object_id>', methods=['PATCH'])
@admin_required
def update_object(object_id):
    try:
        obj = MuseumObject.query.get(object_id)
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found."}}), 404
            
        data = request.json
        
        if 'name' in data: obj.name = data['name']
        if 'title' in data: obj.name = data['title']  # frontend compat
        if 'description' in data: obj.description = data['description']
        if 'museum_id' in data: obj.museum_id = data['museum_id']
        if 'gallery_id' in data: obj.gallery_id = data['gallery_id'] or None
        if 'collection_id' in data: obj.collection_id = data['collection_id'] or None
        if 'image_url' in data: obj.image = data['image_url']
        if 'image' in data: obj.image = data['image']
        if 'period' in data: obj.period = data['period']
        if 'origin' in data: obj.origin = data['origin']
        if 'category' in data: obj.category = data['category']
        if 'latitude' in data: obj.latitude = data['latitude'] or None
        if 'longitude' in data: obj.longitude = data['longitude'] or None
                
        db.session.commit()
        
        # Optionally trigger generation if image changed, here we just trigger if image exists
        if 'image_url' in data or 'image' in data:
            if obj.image:
                trigger_media_generation(obj.id, obj.image, obj.name, obj.description)
                
        return jsonify({
            "data": obj.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

@admin_objects_bp.route('/objects/<int:object_id>', methods=['DELETE'])
@admin_required
def delete_object(object_id):
    try:
        obj = MuseumObject.query.get(object_id)
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found."}}), 404
            
        db.session.delete(obj)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

