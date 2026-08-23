from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import Exhibition, Museum, Collection
from app.extensions import db
from datetime import datetime

admin_exhibitions_bp = Blueprint('admin_exhibitions', __name__)

@admin_exhibitions_bp.route('/exhibitions', methods=['GET'])
@admin_required
def get_exhibitions():
    try:
        museum_id = request.args.get('museum_id')
        query = Exhibition.query
        
        if museum_id:
            query = query.filter_by(museum_id=museum_id)
            
        exhibitions = query.all()
        return jsonify({
            "data": [e.serialize() for e in exhibitions]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch exhibitions."}}), 500

@admin_exhibitions_bp.route('/exhibitions/<int:exhibition_id>', methods=['GET'])
@admin_required
def get_exhibition(exhibition_id):
    try:
        exhibition = Exhibition.query.get(exhibition_id)
        if not exhibition:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Exhibition not found."}}), 404
        return jsonify({
            "data": exhibition.serialize()
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch exhibition."}}), 500

@admin_exhibitions_bp.route('/exhibitions', methods=['POST'])
@admin_required
def create_exhibition():
    try:
        data = request.json
        if not data or not data.get('title') or not data.get('museum_id'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Title and museum_id are required."}}), 400
            
        museum = Museum.query.get(data['museum_id'])
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum does not exist."}}), 404
            
        start_date = None
        end_date = None
        
        if data.get('start_date'):
            try:
                start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"error": {"code": "INVALID_INPUT", "message": "Invalid start_date format. Use YYYY-MM-DD."}}), 400
                
        if data.get('end_date'):
            try:
                end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"error": {"code": "INVALID_INPUT", "message": "Invalid end_date format. Use YYYY-MM-DD."}}), 400
                
        if start_date and end_date and end_date < start_date:
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "End date cannot be before start date."}}), 400
            
        exhibition = Exhibition(
            title=data['title'],
            description=data.get('description'),
            museum_id=data['museum_id'],
            start_date=start_date,
            end_date=end_date,
            image_url=data.get('image_url')
        )
        db.session.add(exhibition)
        db.session.commit()
        return jsonify({
            "data": exhibition.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to create exhibition."}}), 500

@admin_exhibitions_bp.route('/exhibitions/<int:exhibition_id>', methods=['PATCH'])
@admin_required
def update_exhibition(exhibition_id):
    try:
        exhibition = Exhibition.query.get(exhibition_id)
        if not exhibition:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Exhibition not found."}}), 404
            
        data = request.json
        
        if 'museum_id' in data:
            museum = Museum.query.get(data['museum_id'])
            if not museum:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum does not exist."}}), 404
                
        start_date = exhibition.start_date
        end_date = exhibition.end_date
        
        if 'start_date' in data:
            if data['start_date']:
                try:
                    start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({"error": {"code": "INVALID_INPUT", "message": "Invalid start_date format."}}), 400
            else:
                start_date = None
                
        if 'end_date' in data:
            if data['end_date']:
                try:
                    end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({"error": {"code": "INVALID_INPUT", "message": "Invalid end_date format."}}), 400
            else:
                end_date = None
                
        if start_date and end_date and end_date < start_date:
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "End date cannot be before start date."}}), 400

        allowed_fields = ['title', 'description', 'museum_id', 'image_url']
        for field in allowed_fields:
            if field in data:
                setattr(exhibition, field, data[field])
                
        exhibition.start_date = start_date
        exhibition.end_date = end_date
                
        db.session.commit()
        return jsonify({
            "data": exhibition.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to update exhibition."}}), 500

@admin_exhibitions_bp.route('/exhibitions/<int:exhibition_id>', methods=['DELETE'])
@admin_required
def delete_exhibition(exhibition_id):
    try:
        exhibition = Exhibition.query.get(exhibition_id)
        if not exhibition:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Exhibition not found."}}), 404
            
        db.session.delete(exhibition)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to delete exhibition."}}), 500
