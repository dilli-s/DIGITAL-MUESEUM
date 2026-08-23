from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import Collection, Museum, Gallery, MuseumObject
from app.extensions import db

admin_collections_bp = Blueprint('admin_collections', __name__)

@admin_collections_bp.route('/collections', methods=['GET'])
@admin_required
def get_collections():
    try:
        museum_id = request.args.get('museum_id')
        gallery_id = request.args.get('gallery_id')
        query = Collection.query
        
        if museum_id:
            query = query.filter_by(museum_id=museum_id)
        if gallery_id:
            query = query.filter_by(gallery_id=gallery_id)
            
        collections = query.all()
        return jsonify({
            "data": [c.serialize() for c in collections]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch collections."}}), 500

@admin_collections_bp.route('/collections/<int:collection_id>', methods=['GET'])
@admin_required
def get_collection(collection_id):
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Collection not found."}}), 404
        return jsonify({
            "data": collection.serialize()
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch collection."}}), 500

@admin_collections_bp.route('/collections', methods=['POST'])
@admin_required
def create_collection():
    try:
        data = request.json
        if not data or not data.get('name') or not data.get('museum_id'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Name and museum_id are required."}}), 400
            
        museum = Museum.query.get(data['museum_id'])
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum does not exist."}}), 404
            
        if data.get('gallery_id'):
            gallery = Gallery.query.get(data['gallery_id'])
            if not gallery:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Gallery does not exist."}}), 404
            
        collection = Collection(
            name=data['name'],
            description=data.get('description'),
            museum_id=data['museum_id'],
            gallery_id=data.get('gallery_id'),
            image_url=data.get('image_url')
        )
        db.session.add(collection)
        db.session.commit()
        return jsonify({
            "data": collection.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to create collection."}}), 500

@admin_collections_bp.route('/collections/<int:collection_id>', methods=['PATCH'])
@admin_required
def update_collection(collection_id):
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Collection not found."}}), 404
            
        data = request.json
        
        if 'museum_id' in data:
            museum = Museum.query.get(data['museum_id'])
            if not museum:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum does not exist."}}), 404
                
        if 'gallery_id' in data and data['gallery_id']:
            gallery = Gallery.query.get(data['gallery_id'])
            if not gallery:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Gallery does not exist."}}), 404
                
        allowed_fields = ['name', 'description', 'museum_id', 'gallery_id', 'image_url']
        for field in allowed_fields:
            if field in data:
                # Handle empty strings for optional int fields
                if field == 'gallery_id' and data[field] == '':
                    setattr(collection, field, None)
                else:
                    setattr(collection, field, data[field])
                
        db.session.commit()
        return jsonify({
            "data": collection.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to update collection."}}), 500

@admin_collections_bp.route('/collections/<int:collection_id>', methods=['DELETE'])
@admin_required
def delete_collection(collection_id):
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Collection not found."}}), 404
            
        # Check dependencies
        if MuseumObject.query.filter_by(collection_id=collection_id).count() > 0:
            return jsonify({"error": {"code": "CONFLICT", "message": "Cannot delete collection with existing dependencies."}}), 409
            
        db.session.delete(collection)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to delete collection."}}), 500
