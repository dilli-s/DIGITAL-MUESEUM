from app.extensions import db
from datetime import datetime, timezone
from sqlalchemy.types import JSON
from app.models.base import BaseModel

class Activity(BaseModel):
    __tablename__ = 'activities'

    id = db.Column(db.Integer, primary_key=True)
    object_id = db.Column(db.Integer, db.ForeignKey('objects.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    type = db.Column(db.String(50), nullable=True) # e.g. multiple-choice
    difficulty = db.Column(db.String(50), nullable=True)
    
    # Store questions temporarily inside JSON until Phase 13/future models are built
    questions = db.Column(JSON, nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    object = db.relationship('MuseumObject', back_populates='activities')
