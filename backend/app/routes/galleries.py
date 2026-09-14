from flask import Blueprint, jsonify, request
from app.models import Gallery
from app.extensions import db

gallery_bp = Blueprint('gallery', __name__)

def serialize_gallery(g):
    return {
        "id": g.id,
        "museum_id": g.museum_id,
        "name": g.name,
        "description": g.description,
        "image": g.image,
        "boundary_polygon": getattr(g, 'boundary_polygon', None)
    }

@gallery_bp.route('/galleries', methods=['GET'])
def get_galleries():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 12, type=int)
        if per_page > 50: per_page = 50
        
        museum_id = request.args.get('museum_id', type=int)
        search = request.args.get('search')
        query = Gallery.query

        if museum_id:
            query = query.filter(Gallery.museum_id == museum_id)

        if search:
            search = f"%{search}%"
            query = query.filter(
                db.or_(
                    Gallery.name.ilike(search),
                    Gallery.description.ilike(search)
                )
            )

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            "data": [serialize_gallery(g) for g in paginated.items],
            "pagination": {
                "page": paginated.page,
                "per_page": paginated.per_page,
                "total": paginated.total,
                "pages": paginated.pages
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@gallery_bp.route('/galleries/<int:id>', methods=['GET'])
def get_gallery(id):
    try:
        gallery = db.session.get(Gallery, id)
        if not gallery:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Gallery not found"}}), 404
        return jsonify({"data": serialize_gallery(gallery)})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
