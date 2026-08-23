from flask import Blueprint, jsonify, request
from app.models import Collection
from app.extensions import db

collection_bp = Blueprint('collection', __name__)

def serialize_collection(c):
    return {
        "id": c.id,
        "museum_id": c.museum_id,
        "name": c.name,
        "description": c.description,
        "image": c.image
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
