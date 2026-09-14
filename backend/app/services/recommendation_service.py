from app.models import MuseumObject
from app.models.bookmark import Bookmark
from app.models.history import UserHistory
from app.extensions import db


def get_recommendations_for_object(object_id, limit=8):
    """Build the Explore More chain from the selected object's context."""
    source = db.session.get(MuseumObject, object_id)
    if not source:
        return None

    related_query = MuseumObject.query.filter(MuseumObject.id != source.id)
    if source.category:
        related_query = related_query.filter(MuseumObject.category == source.category)
    else:
        related_query = related_query.filter(MuseumObject.museum_id == source.museum_id)

    related_objects = related_query.limit(limit).all()
    return {
        "object": {"id": source.id, "name": source.name, "category": source.category},
        "related_objects": [
            {"id": obj.id, "name": obj.name, "image": obj.image, "category": obj.category, "period": obj.period}
            for obj in related_objects
        ],
        "themes": ([{"id": source.category, "name": source.category}] if source.category else []),
        "stories": [
            {"id": story.id, "title": story.title, "summary": story.summary, "image": story.image}
            for story in source.stories
        ],
        "learning": [
            {"id": item.id, "title": item.title, "description": item.description, "type": item.type}
            for item in source.learning_resources
        ],
    }

def get_recommendations_for_user(user_id, limit=10):
    """
    Simple recommendation engine.
    1. Find categories the user has interacted with (bookmarks, history).
    2. Suggest other objects in those categories.
    3. Fallback to featured objects if no history.
    """
    
    # Get user's interests (categories of bookmarked or viewed objects)
    # Let's get object IDs first
    interested_object_ids = set()
    
    bookmarks = Bookmark.query.filter_by(user_id=user_id, content_type='object').all()
    for b in bookmarks:
        interested_object_ids.add(b.content_id)
        
    history = UserHistory.query.filter_by(user_id=user_id, content_type='object').all()
    for h in history:
        interested_object_ids.add(h.content_id)
        
    if not interested_object_ids:
        # Fallback to featured objects
        fallback_objects = MuseumObject.query.filter_by(featured=True).limit(limit).all()
        return [{
            "type": "object",
            "id": obj.id,
            "title": obj.name,
            "reason": "Featured in our collection."
        } for obj in fallback_objects]
        
    # Get categories of interested objects
    interested_objects = MuseumObject.query.filter(MuseumObject.id.in_(interested_object_ids)).all()
    categories = list(set([obj.category for obj in interested_objects if obj.category]))
    
    if not categories:
        categories = ["Ancient"] # fallback category
        
    # Find other objects in those categories
    recommendations = MuseumObject.query.filter(
        MuseumObject.category.in_(categories),
        ~MuseumObject.id.in_(interested_object_ids)
    ).limit(limit).all()
    
    # If still not enough, add featured
    if len(recommendations) < limit:
        needed = limit - len(recommendations)
        extra = MuseumObject.query.filter(
            MuseumObject.featured == True,
            ~MuseumObject.id.in_(interested_object_ids),
            ~MuseumObject.id.in_([r.id for r in recommendations])
        ).limit(needed).all()
        recommendations.extend(extra)
        
    results = []
    for obj in recommendations:
        reason = f"Because you explored {obj.category} artifacts." if obj.category in categories else "Popular in our collection."
        results.append({
            "type": "object",
            "id": obj.id,
            "title": obj.name,
            "reason": reason
        })
        
    return results
