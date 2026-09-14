from app.extensions import db
from datetime import datetime, timezone
from sqlalchemy.types import JSON
from app.models.base import BaseModel

class Story(BaseModel):
    __tablename__ = 'stories'

    id = db.Column(db.Integer, primary_key=True)
    object_id = db.Column(db.Integer, db.ForeignKey('objects.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    summary = db.Column(db.Text, nullable=True)
    image = db.Column(db.Text, nullable=True)
    
    content = db.Column(JSON, nullable=True)
    
    duration = db.Column(db.String(50), nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    object = db.relationship('MuseumObject', back_populates='stories')
