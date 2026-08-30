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
        if not data or not data.get('name'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Name is required."}}), 400
            
        museum = Museum(
            name=data['name'],
            description=data.get('description'),
            location=data.get('location'),
            latitude=float(data['latitude']) if data.get('latitude') else None,
            longitude=float(data['longitude']) if data.get('longitude') else None,
            image=data.get('image_url') or data.get('image'),
            
            entrance_lat=float(data['entrance_lat']) if data.get('entrance_lat') else None,
            entrance_lng=float(data['entrance_lng']) if data.get('entrance_lng') else None,
            exit_lat=float(data['exit_lat']) if data.get('exit_lat') else None,
            exit_lng=float(data['exit_lng']) if data.get('exit_lng') else None,
            washroom_lat=float(data['washroom_lat']) if data.get('washroom_lat') else None,
            washroom_lng=float(data['washroom_lng']) if data.get('washroom_lng') else None,
            cafe_lat=float(data['cafe_lat']) if data.get('cafe_lat') else None,
            cafe_lng=float(data['cafe_lng']) if data.get('cafe_lng') else None,
            pathing_graph=data.get('pathing_graph'),
            
            floorplan_image=data.get('floorplan_image'),
            bounds_tl_lat=float(data['bounds_tl_lat']) if data.get('bounds_tl_lat') else None,
            bounds_tl_lng=float(data['bounds_tl_lng']) if data.get('bounds_tl_lng') else None,
            bounds_br_lat=float(data['bounds_br_lat']) if data.get('bounds_br_lat') else None,
            bounds_br_lng=float(data['bounds_br_lng']) if data.get('bounds_br_lng') else None,
            
            opening_hours=data.get('opening_hours'),
            contact_email=data.get('contact_email'),
            contact_phone=data.get('contact_phone'),
            wheelchair_access=data.get('wheelchair_access', False),
            info_desk=data.get('info_desk', False),
            cafe_restrooms=data.get('cafe_restrooms', False),
        )
        db.session.add(museum)
        db.session.commit()
        return jsonify({
            "data": museum.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating museum: {e}")
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

@admin_museums_bp.route('/museums/<int:museum_id>', methods=['PATCH'])
@admin_required
def update_museum(museum_id):
    try:
        museum = Museum.query.get(museum_id)
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum not found."}}), 404
            
        data = request.json
        
        for field in ['name', 'description', 'location', 'opening_hours', 'contact_email', 'contact_phone', 'pathing_graph', 'floorplan_image']:
            if field in data:
                setattr(museum, field, data[field])
        if 'latitude' in data: museum.latitude = float(data['latitude']) if data['latitude'] else None
        if 'longitude' in data: museum.longitude = float(data['longitude']) if data['longitude'] else None
        if 'image_url' in data: museum.image = data['image_url']
        if 'image' in data: museum.image = data['image']
        
        # Indoor Mapping Facility Coordinates
        if 'entrance_lat' in data: museum.entrance_lat = float(data['entrance_lat']) if data['entrance_lat'] else None
        if 'entrance_lng' in data: museum.entrance_lng = float(data['entrance_lng']) if data['entrance_lng'] else None
        if 'exit_lat' in data: museum.exit_lat = float(data['exit_lat']) if data['exit_lat'] else None
        if 'exit_lng' in data: museum.exit_lng = float(data['exit_lng']) if data['exit_lng'] else None
        if 'washroom_lat' in data: museum.washroom_lat = float(data['washroom_lat']) if data['washroom_lat'] else None
        if 'washroom_lng' in data: museum.washroom_lng = float(data['washroom_lng']) if data['washroom_lng'] else None
        if 'cafe_lat' in data: museum.cafe_lat = float(data['cafe_lat']) if data['cafe_lat'] else None
        if 'cafe_lng' in data: museum.cafe_lng = float(data['cafe_lng']) if data['cafe_lng'] else None
        
        if 'bounds_tl_lat' in data: museum.bounds_tl_lat = float(data['bounds_tl_lat']) if data['bounds_tl_lat'] else None
        if 'bounds_tl_lng' in data: museum.bounds_tl_lng = float(data['bounds_tl_lng']) if data['bounds_tl_lng'] else None
        if 'bounds_br_lat' in data: museum.bounds_br_lat = float(data['bounds_br_lat']) if data['bounds_br_lat'] else None
        if 'bounds_br_lng' in data: museum.bounds_br_lng = float(data['bounds_br_lng']) if data['bounds_br_lng'] else None
        
        if 'opening_hours' in data: museum.opening_hours = data['opening_hours']
        if 'contact_email' in data: museum.contact_email = data['contact_email']
        if 'contact_phone' in data: museum.contact_phone = data['contact_phone']
        if 'wheelchair_access' in data: museum.wheelchair_access = data['wheelchair_access']
        if 'info_desk' in data: museum.info_desk = data['info_desk']
        if 'cafe_restrooms' in data: museum.cafe_restrooms = data['cafe_restrooms']
                
        db.session.commit()
        return jsonify({
            "data": museum.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

@admin_museums_bp.route('/museums/<int:museum_id>', methods=['DELETE'])
@admin_required
def delete_museum(museum_id):
    try:
        museum = Museum.query.get(museum_id)
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum not found."}}), 404
            
        db.session.delete(museum)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": str(e)}}), 500

