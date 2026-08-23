from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import Museum, Gallery, MuseumObject, Exhibition, Collection
from app.extensions import db

admin_museums_bp = Blueprint('admin_museums', __name__)

@admin_museums_bp.route('/museums', methods=['GET'])
@admin_required
def get_museums():
    try:
        museums = Museum.query.all()
        return jsonify({
            "data": [m.serialize() for m in museums]
        })
    except Exception as e:
        print(f"Error fetching museums: {e}")
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch museums."}}), 500

@admin_museums_bp.route('/museums/<int:museum_id>', methods=['GET'])
@admin_required
def get_museum(museum_id):
    try:
        museum = Museum.query.get(museum_id)
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum not found."}}), 404
        return jsonify({
            "data": museum.serialize()
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch museum."}}), 500

@admin_museums_bp.route('/museums', methods=['POST'])
@admin_required
def create_museum():
    try:
        data = request.json
        if not data or not data.get('name') or not data.get('location'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Name and location are required."}}), 400
            
        museum = Museum(
            name=data['name'],
            description=data.get('description'),
            location=data['location'],
            established_year=data.get('established_year'),
            image_url=data.get('image_url')
        )
        db.session.add(museum)
        db.session.commit()
        return jsonify({
            "data": museum.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to create museum."}}), 500

@admin_museums_bp.route('/museums/<int:museum_id>', methods=['PATCH'])
@admin_required
def update_museum(museum_id):
    try:
        museum = Museum.query.get(museum_id)
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum not found."}}), 404
            
        data = request.json
        
        # Explicitly only allow safe fields
        allowed_fields = ['name', 'description', 'location', 'established_year', 'image_url']
        for field in allowed_fields:
            if field in data:
                setattr(museum, field, data[field])
                
        db.session.commit()
        return jsonify({
            "data": museum.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to update museum."}}), 500

@admin_museums_bp.route('/museums/<int:museum_id>', methods=['DELETE'])
@admin_required
def delete_museum(museum_id):
    try:
        museum = Museum.query.get(museum_id)
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum not found."}}), 404
            
        # Check dependencies
        if Gallery.query.filter_by(museum_id=museum_id).count() > 0 or \
           Collection.query.filter_by(museum_id=museum_id).count() > 0 or \
           Exhibition.query.filter_by(museum_id=museum_id).count() > 0 or \
           MuseumObject.query.filter_by(museum_id=museum_id).count() > 0:
            return jsonify({"error": {"code": "CONFLICT", "message": "Cannot delete museum with existing dependencies."}}), 409
            
        db.session.delete(museum)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to delete museum."}}), 500
