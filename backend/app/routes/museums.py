from flask import Blueprint, jsonify, request
from app.models import Museum
from app.extensions import db

museum_bp = Blueprint('museum', __name__)

def serialize_museum(m):
    return {
        "id": m.id,
        "name": m.name,
        "description": m.description,
        "location": m.location,
        "image": m.image,
        "latitude": m.latitude,
        "longitude": m.longitude,
        "entrance_lat": m.entrance_lat,
        "entrance_lng": m.entrance_lng,
        "exit_lat": m.exit_lat,
        "exit_lng": m.exit_lng,
        "washroom_lat": m.washroom_lat,
        "washroom_lng": m.washroom_lng,
        "cafe_lat": m.cafe_lat,
        "cafe_lng": m.cafe_lng,
        "pathing_graph": m.pathing_graph,
        "floorplan_image": m.floorplan_image,
        "bounds_tl_lat": m.bounds_tl_lat,
        "bounds_tl_lng": m.bounds_tl_lng,
        "bounds_br_lat": m.bounds_br_lat,
        "bounds_br_lng": m.bounds_br_lng,
        "opening_hours": m.opening_hours,
        "contact_email": m.contact_email,
        "contact_phone": m.contact_phone,
        "wheelchair_access": m.wheelchair_access,
        "info_desk": m.info_desk,
        "cafe_restrooms": m.cafe_restrooms,
        "galleryCount": len(m.galleries) if hasattr(m, 'galleries') and m.galleries else 0,
        "collectionCount": len(m.collections) if hasattr(m, 'collections') and m.collections else 0,
        "objectCount": len(m.objects) if hasattr(m, 'objects') and m.objects else 0,
        "exhibitionCount": len(m.exhibitions) if hasattr(m, 'exhibitions') and m.exhibitions else 0
    }

@museum_bp.route('/museums', methods=['GET'])
def get_museums():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 12, type=int)
        if per_page > 50: per_page = 50
        
        search = request.args.get('search')
        query = Museum.query

        if search:
            search = f"%{search}%"
            query = query.filter(
                db.or_(
                    Museum.name.ilike(search),
                    Museum.description.ilike(search),
                    Museum.location.ilike(search)
                )
            )

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            "data": [serialize_museum(m) for m in paginated.items],
            "pagination": {
                "page": paginated.page,
                "per_page": paginated.per_page,
                "total": paginated.total,
                "pages": paginated.pages
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@museum_bp.route('/museums/<int:id>', methods=['GET'])
def get_museum(id):
    try:
        museum = db.session.get(Museum, id)
        if not museum:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Museum not found"}}), 404
        return jsonify({"data": serialize_museum(museum)})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
