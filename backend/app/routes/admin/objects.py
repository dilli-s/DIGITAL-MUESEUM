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
            try:
                query = query.filter_by(museum_id=int(museum_id))
            except (ValueError, TypeError):
                query = query.filter_by(museum_id=museum_id)
        if gallery_id:
            try:
                query = query.filter_by(gallery_id=int(gallery_id))
            except (ValueError, TypeError):
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
            
        lat_raw = data.get('latitude')
        lng_raw = data.get('longitude')
        lat = None
        lng = None
        
        if lat_raw is not None and lng_raw is not None and str(lat_raw).strip() != '' and str(lng_raw).strip() != '':
            try:
                lat = float(lat_raw)
                lng = float(lng_raw)
            except (ValueError, TypeError):
                return jsonify({"error": {"code": "INVALID_LOCATION", "message": "Latitude and Longitude must be valid numbers."}}), 400
                
            m_lat = float(museum.latitude) if museum and museum.latitude is not None else 13.073226
            m_lng = float(museum.longitude) if museum and museum.longitude is not None else 80.257045
            
            if abs(lat - m_lat) > 0.05 or abs(lng - m_lng) > 0.05 or lat == 0 or lng == 0:
                return jsonify({"error": {"code": "BOUNDING_BOX_ERROR", "message": f"Coordinates ({lat}, {lng}) fall outside the physical bounding box for {museum.name}."}}), 400
        else:
            # Floor-plan placement does not require georeferencing.
            lat = None
            lng = None
            
        obj = MuseumObject(
            name=name,
            local_name=data.get('local_name'),
            common_name=data.get('common_name'),
            scientific_name=data.get('scientific_name'),
            description=data.get('description'),
            significance=data.get('significance'),
            facts=data.get('facts') or [],
            images=data.get('images') or [],
            museum_id=data['museum_id'],
            gallery_id=data.get('gallery_id') or None,
            collection_id=data.get('collection_id') or None,
            image=data.get('image_url') or data.get('image'),
            period=data.get('period'),
            origin=data.get('origin'),
            category=data.get('category'),
            latitude=lat,
            longitude=lng,
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
        
        # Validate latitude/longitude if being updated or if mandatory check is requested
        if 'latitude' in data or 'longitude' in data:
            lat_raw = data.get('latitude')
            lng_raw = data.get('longitude')
            if lat_raw is None or lng_raw is None or str(lat_raw).strip() == '' or str(lng_raw).strip() == '':
                return jsonify({"error": {"code": "INVALID_LOCATION", "message": "Coordinates (latitude and longitude) are mandatory. Exhibits cannot have empty location coordinates."}}), 400
            try:
                lat = float(lat_raw)
                lng = float(lng_raw)
            except (ValueError, TypeError):
                return jsonify({"error": {"code": "INVALID_LOCATION", "message": "Latitude and Longitude must be valid numbers."}}), 400
                
            museum_id = data.get('museum_id') or obj.museum_id
            museum = Museum.query.get(museum_id)
            m_lat = float(museum.latitude) if museum and museum.latitude is not None else 13.073226
            m_lng = float(museum.longitude) if museum and museum.longitude is not None else 80.257045
            
            if abs(lat - m_lat) > 0.005 or abs(lng - m_lng) > 0.005 or lat == 0 or lng == 0:
                return jsonify({"error": {"code": "BOUNDING_BOX_ERROR", "message": f"Coordinates ({lat}, {lng}) fall outside the physical bounding box for {museum.name if museum else 'the museum'}."}}), 400
                
            obj.latitude = lat
            obj.longitude = lng

        if 'name' in data: obj.name = data['name']
        if 'title' in data: obj.name = data['title']  # frontend compat
        if 'local_name' in data: obj.local_name = data['local_name']
        if 'common_name' in data: obj.common_name = data['common_name']
        if 'scientific_name' in data: obj.scientific_name = data['scientific_name']
        if 'description' in data: obj.description = data['description']
        if 'significance' in data: obj.significance = data['significance']
        if 'facts' in data: obj.facts = data['facts'] or []
        if 'images' in data: obj.images = data['images'] or []
        if 'museum_id' in data: obj.museum_id = data['museum_id']
        if 'gallery_id' in data: obj.gallery_id = data['gallery_id'] or None
        if 'collection_id' in data: obj.collection_id = data['collection_id'] or None
        if 'image_url' in data: obj.image = data['image_url']
        if 'image' in data: obj.image = data['image']
        if 'period' in data: obj.period = data['period']
        if 'origin' in data: obj.origin = data['origin']
        if 'category' in data: obj.category = data['category']
                
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

