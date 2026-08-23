from app.extensions import db
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON

class LearningResource(db.Model):
    __tablename__ = 'learning_resources'

    id = db.Column(db.Integer, primary_key=True)
    object_id = db.Column(db.Integer, db.ForeignKey('objects.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    type = db.Column(db.String(50), nullable=True) # e.g. article
    
    # Store structured content like [{"heading": "...", "text": "..."}]
    # Using JSON as a fallback for SQLite support in dev, would normally use JSONB in postgres
    content = db.Column(JSON, nullable=True)
    
    duration = db.Column(db.String(50), nullable=True)
    difficulty = db.Column(db.String(50), nullable=True)
    category = db.Column(db.String(50), nullable=True)
    featured = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    object = db.relationship('MuseumObject', back_populates='learning_resources')
