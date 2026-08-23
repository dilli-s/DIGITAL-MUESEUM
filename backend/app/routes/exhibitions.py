from flask import Blueprint, jsonify, request
from app.models import Exhibition, MuseumObject
from app.extensions import db

exhibition_bp = Blueprint('exhibition', __name__)

def serialize_exhibition(e):
    return {
        "id": e.id,
        "museum_id": e.museum_id,
        "title": e.title,
        "subtitle": e.subtitle,
        "description": e.description,
        "long_description": e.long_description,
        "image": e.image,
        "category": e.category,
        "theme": e.theme,
        "period": e.period,
        "location": e.location,
        "start_date": e.start_date.isoformat() if e.start_date else None,
        "end_date": e.end_date.isoformat() if e.end_date else None,
        "featured": e.featured
    }

@exhibition_bp.route('/exhibitions', methods=['GET'])
def get_exhibitions():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 12, type=int)
        if per_page > 50: per_page = 50
        
        museum_id = request.args.get('museum_id', type=int)
        featured = request.args.get('featured')
        category = request.args.get('category')
        search = request.args.get('search')
        
        query = Exhibition.query

        if museum_id:
            query = query.filter(Exhibition.museum_id == museum_id)
            
        if featured is not None:
            is_featured = featured.lower() == 'true'
            query = query.filter(Exhibition.featured == is_featured)
            
        if category:
            query = query.filter(Exhibition.category == category)

        if search:
            search = f"%{search}%"
            query = query.filter(
                db.or_(
                    Exhibition.title.ilike(search),
                    Exhibition.subtitle.ilike(search),
                    Exhibition.description.ilike(search),
                    Exhibition.category.ilike(search),
                    Exhibition.theme.ilike(search)
                )
            )

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            "data": [serialize_exhibition(e) for e in paginated.items],
            "pagination": {
                "page": paginated.page,
                "per_page": paginated.per_page,
                "total": paginated.total,
                "pages": paginated.pages
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@exhibition_bp.route('/exhibitions/<int:id>', methods=['GET'])
def get_exhibition(id):
    try:
        exhibition = db.session.get(Exhibition, id)
        if not exhibition:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Exhibition not found"}}), 404
        return jsonify({"data": serialize_exhibition(exhibition)})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@exhibition_bp.route('/exhibitions/<int:id>/objects', methods=['GET'])
def get_exhibition_objects(id):
    try:
        exhibition = db.session.get(Exhibition, id)
        if not exhibition:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Exhibition not found"}}), 404
        
        # We need a local import or function to serialize objects. Let's just import it from routes.objects
        from app.routes.objects import serialize_object
        
        objects_data = [serialize_object(o) for o in exhibition.objects]
        return jsonify({"data": objects_data})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
