from flask import Blueprint, jsonify, request
from app.models import LearningResource
from app.models.history import UserHistory
from app.extensions import db
from flask_login import current_user

learning_bp = Blueprint('learning', __name__)

def serialize_learning(lr):
    return {
        "id": lr.id,
        "objectId": lr.object_id,
        "title": lr.title,
        "description": lr.description,
        "type": lr.type,
        "content": lr.content,
        "duration": lr.duration,
        "difficulty": lr.difficulty,
        "category": lr.category,
        "featured": lr.featured
    }

@learning_bp.route('/learning', methods=['GET'])
def get_learning_resources():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 12, type=int)
        if per_page > 50: per_page = 50
        
        object_id = request.args.get('object_id', type=int)
        category = request.args.get('category')
        difficulty = request.args.get('difficulty')
        search = request.args.get('search')
        
        query = LearningResource.query

        if object_id:
            query = query.filter(LearningResource.object_id == object_id)
        if category:
            query = query.filter(LearningResource.category == category)
        if difficulty:
            query = query.filter(LearningResource.difficulty == difficulty)

        if search:
            search = f"%{search}%"
            query = query.filter(
                db.or_(
                    LearningResource.title.ilike(search),
                    LearningResource.description.ilike(search),
                    LearningResource.category.ilike(search)
                )
            )

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            "data": [serialize_learning(lr) for lr in paginated.items],
            "pagination": {
                "page": paginated.page,
                "per_page": paginated.per_page,
                "total": paginated.total,
                "pages": paginated.pages
            }
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@learning_bp.route('/learning/<int:id>', methods=['GET'])
def get_learning_resource(id):
    try:
        lr = db.session.get(LearningResource, id)
        if not lr:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Learning content not found"}}), 404
        
        if current_user.is_authenticated:
            history = UserHistory(user_id=current_user.id, content_type='learning', content_id=id, action='viewed')
            db.session.add(history)
            db.session.commit()
        
        return jsonify({"data": serialize_learning(lr)})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500
