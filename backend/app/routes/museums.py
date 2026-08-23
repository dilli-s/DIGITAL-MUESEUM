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
        "image": m.image
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
