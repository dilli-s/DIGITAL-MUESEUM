from app.extensions import db
from datetime import datetime, timezone
from app.models.base import BaseModel

class Exhibition(BaseModel):
    __tablename__ = 'exhibitions'

    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.Integer, db.ForeignKey('museums.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    subtitle = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    long_description = db.Column(db.Text, nullable=True)
    image = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(100), nullable=True)
    theme = db.Column(db.String(100), nullable=True)
    period = db.Column(db.String(100), nullable=True)
    location = db.Column(db.String(255), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    featured = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    museum = db.relationship('Museum', back_populates='exhibitions')
    objects = db.relationship('MuseumObject', secondary='exhibition_objects', back_populates='exhibitions')
