from app.extensions import db
from datetime import datetime, timezone

class Museum(db.Model):
    __tablename__ = 'museums'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    location = db.Column(db.String(255), nullable=True)
    image = db.Column(db.String(255), nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    galleries = db.relationship('Gallery', back_populates='museum', cascade='all, delete-orphan')
    collections = db.relationship('Collection', back_populates='museum', cascade='all, delete-orphan')
    exhibitions = db.relationship('Exhibition', back_populates='museum', cascade='all, delete-orphan')
    objects = db.relationship('MuseumObject', back_populates='museum', cascade='all, delete-orphan')
