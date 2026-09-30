from flask import Blueprint, jsonify, request
from app.models import Collection
from app.extensions import db

collection_bp = Blueprint('collection', __name__)

def serialize_collection(c):
    obj_count = len(c.objects) if hasattr(c, 'objects') and c.objects else 0
    return {
        "id": c.id,
        "museum_id": c.museum_id,
        "museum": {
            "id": c.museum.id,
            "name": c.museum.name,
            "location": c.museum.location,
            "image": c.museum.image
        } if c.museum else None,
        "museum_name": c.museum.name if c.museum else None,
        "museum_location": c.museum.location if c.museum else None,
        "museum_image": c.museum.image if c.museum else None,
        "name": c.name,
        "description": c.description,
        "image": c.image,
        "objectCount": obj_count,
        "object_count": obj_count
    }

@collection_bp.route('/collections', methods=['GET'])
def get_collections():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 12, type=int)
        if per_page > 50: per_page = 50
        
        museum_id = request.args.get('museum_id', type=int)
        search = request.args.get('search')
        query = Collection.query

        if museum_id:
            query = query.filter(Collection.museum_id == museum_id)

        if search:
            search = f"%{search}%"
            query = query.filter(
                db.or_(
                    Collection.name.ilike(search),
                    Collection.description.ilike(search)
                )
            )

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            "data": [serialize_collection(c) for c in paginated.items],
            "pagination": {
                "page": paginated.page,
                "per_page": paginated.per_page,
                "total": paginated.total,
                "pages": paginated.pages
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@collection_bp.route('/collections/<int:id>', methods=['GET'])
def get_collection(id):
    try:
        collection = db.session.get(Collection, id)
        if not collection:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Collection not found"}}), 404
        return jsonify({"data": serialize_collection(collection)})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
