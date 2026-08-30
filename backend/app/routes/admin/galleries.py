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
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

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
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

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
            image=data.get('image_url') or data.get('image'),
            floor=data.get('floor') or 'Ground Floor',
        )
        db.session.add(gallery)
        db.session.commit()
        return jsonify({
            "data": gallery.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating gallery: {e}")
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

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
            gallery.museum_id = data['museum_id']
        
        if 'name' in data: gallery.name = data['name']
        if 'description' in data: gallery.description = data['description']
        if 'image_url' in data: gallery.image = data['image_url']
        if 'image' in data: gallery.image = data['image']
        if 'floor' in data: gallery.floor = data['floor']
                
        db.session.commit()
        return jsonify({
            "data": gallery.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

@admin_galleries_bp.route('/galleries/<int:gallery_id>', methods=['DELETE'])
@admin_required
def delete_gallery(gallery_id):
    try:
        gallery = Gallery.query.get(gallery_id)
        if not gallery:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Gallery not found."}}), 404
            
        db.session.delete(gallery)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

