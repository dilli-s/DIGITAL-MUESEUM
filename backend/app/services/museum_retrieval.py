from app.models import MuseumObject, LearningResource, Story, Activity
from app.extensions import db

def retrieve_museum_context(question):
    """
    Retrieves top N relevant records from the database based on the query.
    For simplicity, does a naive ILIKE text search across common text fields.
    """
    search_term = f"%{question}%"
    limit_per_category = 2
    
    # 1. Search Objects
    objects = MuseumObject.query.filter(
        db.or_(
            MuseumObject.name.ilike(search_term),
            MuseumObject.description.ilike(search_term),
            MuseumObject.category.ilike(search_term)
        )
    ).limit(limit_per_category).all()
    
    # 2. Search Learning Resources
    learnings = LearningResource.query.filter(
        db.or_(
            LearningResource.title.ilike(search_term),
            LearningResource.description.ilike(search_term),
            LearningResource.category.ilike(search_term)
        )
    ).limit(limit_per_category).all()
    
    # 3. Stories
    stories = Story.query.filter(
        db.or_(
            Story.title.ilike(search_term),
            Story.summary.ilike(search_term)
        )
    ).limit(limit_per_category).all()
    
    # We could also search activities if needed, but keeping it small.

    # Build context and sources
    context_lines = []
    sources = []
    
    for obj in objects:
        context_lines.append(f"Museum Object: {obj.name}\nDescription: {obj.description}\nCategory: {obj.category}")
        sources.append({"id": obj.id, "type": "object", "title": obj.name})
        
    for lr in learnings:
        context_lines.append(f"Learning Resource: {lr.title}\nDescription: {lr.description}")
        sources.append({"id": lr.id, "type": "learning", "title": lr.title})
        
    for st in stories:
        context_lines.append(f"Story: {st.title}\nContent snippet: {st.content[:200] if st.content else ''}")
        sources.append({"id": st.id, "type": "story", "title": st.title})

    context_text = "\n\n".join(context_lines)
    if not context_text:
        context_text = "No specific database records matched."

    return context_text, sources
