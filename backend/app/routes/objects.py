from flask import Blueprint, jsonify, request
from app.models import MuseumObject
from app.models.history import UserHistory
from app.extensions import db
from flask_login import current_user

object_bp = Blueprint('object', __name__)

def serialize_object(o):
    return {
        "id": o.id,
        "museum_id": o.museum_id,
        "gallery_id": o.gallery_id,
        "collection_id": o.collection_id,
        "name": o.name,
        "local_name": o.local_name,
        "common_name": o.common_name,
        "scientific_name": o.scientific_name,
        "description": o.description,
        "significance": o.significance,
        "facts": o.facts or [],
        "images": o.images or ([o.image] if o.image else []),
        "image": o.image,
        "object_code": o.object_code,
        "period": o.period,
        "origin": o.origin,
        "category": o.category,
        "featured": o.featured,
        "latitude": o.latitude,
        "longitude": o.longitude,
        "audio_url": o.audio_url,
        "video_url": o.video_url,
        "model_3d_url": o.model_3d_url,
        "media_status": o.media_status
    }

@object_bp.route('/objects', methods=['GET'])
def get_objects():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 12, type=int)
        if per_page > 50: per_page = 50
        
        museum_id = request.args.get('museum_id', type=int)
        gallery_id = request.args.get('gallery_id', type=int)
        collection_id = request.args.get('collection_id', type=int)
        featured = request.args.get('featured')
        category = request.args.get('category')
        search = request.args.get('search')
        
        query = MuseumObject.query

        if museum_id:
            query = query.filter(MuseumObject.museum_id == museum_id)
        if gallery_id:
            query = query.filter(MuseumObject.gallery_id == gallery_id)
        if collection_id:
            query = query.filter(MuseumObject.collection_id == collection_id)
            
        if featured is not None:
            is_featured = featured.lower() == 'true'
            query = query.filter(MuseumObject.featured == is_featured)
            
        if category:
            query = query.filter(MuseumObject.category == category)

        if search:
            search = f"%{search}%"
            query = query.filter(
                db.or_(
                    MuseumObject.name.ilike(search),
                    MuseumObject.description.ilike(search),
                    MuseumObject.category.ilike(search),
                    MuseumObject.origin.ilike(search),
                    MuseumObject.period.ilike(search)
                )
            )

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            "data": [serialize_object(o) for o in paginated.items],
            "pagination": {
                "page": paginated.page,
                "per_page": paginated.per_page,
                "total": paginated.total,
                "pages": paginated.pages
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@object_bp.route('/objects/<int:id>', methods=['GET'])
def get_object(id):
    try:
        obj = db.session.get(MuseumObject, id)
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found"}}), 404
        
        if current_user.is_authenticated:
            history = UserHistory(user_id=current_user.id, content_type='object', content_id=id, action='viewed')
            db.session.add(history)
            db.session.commit()
        
        # Include limited relationship summary for detail view
        data = serialize_object(obj)
        data['exhibitions'] = [{"id": e.id, "title": e.title} for e in obj.exhibitions]
        
        return jsonify({"data": data})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@object_bp.route('/objects/code/<code>', methods=['GET'])
def get_object_by_code(code):
    try:
        obj = MuseumObject.query.filter_by(object_code=code).first()
        if not obj:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found"}}), 404
        return jsonify({"data": serialize_object(obj)})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
