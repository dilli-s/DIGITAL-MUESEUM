from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import Gallery, Museum, MuseumObject, Collection
from app.extensions import db

admin_galleries_bp = Blueprint('admin_galleries', __name__)

@admin_galleries_bp.route('/galleries', methods=['GET'])
@admin_required
def get_galleries():
    try:
        museum_id = request.args.get('museum_id')
        query = Gallery.query
        
        if museum_id:
            query = query.filter_by(museum_id=museum_id)
            
        galleries = query.all()
        return jsonify({
            "data": [g.serialize() for g in galleries]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch galleries."}}), 500

@admin_galleries_bp.route('/galleries/<int:gallery_id>', methods=['GET'])
@admin_required
def get_gallery(gallery_id):
    try:
        gallery = Gallery.query.get(gallery_id)
        if not gallery:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Gallery not found."}}), 404
        return jsonify({
            "data": gallery.serialize()
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch gallery."}}), 500

@admin_galleries_bp.route('/galleries', methods=['POST'])
@admin_required
def create_gallery():
    try:
        data = request.json
        if not data or not data.get('name') or not data.get('museum_id'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Name and museum_id are required."}}), 400
            
        museum = Museum.query.get(data['museum_id'])
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum does not exist."}}), 404
            
        gallery = Gallery(
            name=data['name'],
            description=data.get('description'),
            museum_id=data['museum_id'],
            floor=data.get('floor'),
            image_url=data.get('image_url')
        )
        db.session.add(gallery)
        db.session.commit()
        return jsonify({
            "data": gallery.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to create gallery."}}), 500

@admin_galleries_bp.route('/galleries/<int:gallery_id>', methods=['PATCH'])
@admin_required
def update_gallery(gallery_id):
    try:
        gallery = Gallery.query.get(gallery_id)
        if not gallery:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Gallery not found."}}), 404
            
        data = request.json
        
        if 'museum_id' in data:
            museum = Museum.query.get(data['museum_id'])
            if not museum:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum does not exist."}}), 404
                
        allowed_fields = ['name', 'description', 'museum_id', 'floor', 'image_url']
        for field in allowed_fields:
            if field in data:
                setattr(gallery, field, data[field])
                
        db.session.commit()
        return jsonify({
            "data": gallery.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to update gallery."}}), 500

@admin_galleries_bp.route('/galleries/<int:gallery_id>', methods=['DELETE'])
@admin_required
def delete_gallery(gallery_id):
    try:
        gallery = Gallery.query.get(gallery_id)
        if not gallery:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Gallery not found."}}), 404
            
        # Check dependencies
        if MuseumObject.query.filter_by(gallery_id=gallery_id).count() > 0 or \
           Collection.query.filter_by(gallery_id=gallery_id).count() > 0:
            return jsonify({"error": {"code": "CONFLICT", "message": "Cannot delete gallery with existing dependencies."}}), 409
            
        db.session.delete(gallery)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to delete gallery."}}), 500
