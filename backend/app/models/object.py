from app.extensions import db
from datetime import datetime, timezone

# Association table for many-to-many relationship
exhibition_objects = db.Table('exhibition_objects',
    db.Column('exhibition_id', db.Integer, db.ForeignKey('exhibitions.id'), primary_key=True),
    db.Column('object_id', db.Integer, db.ForeignKey('objects.id'), primary_key=True)
)

class MuseumObject(db.Model):
    __tablename__ = 'objects'

    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.Integer, db.ForeignKey('museums.id'), nullable=False)
    gallery_id = db.Column(db.Integer, db.ForeignKey('galleries.id'), nullable=True)
    collection_id = db.Column(db.Integer, db.ForeignKey('collections.id'), nullable=True)
    
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image = db.Column(db.String(255), nullable=True)
    object_code = db.Column(db.String(100), unique=True, nullable=True)
    
    period = db.Column(db.String(100), nullable=True)
    origin = db.Column(db.String(100), nullable=True)
    category = db.Column(db.String(100), nullable=True)
    featured = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    museum = db.relationship('Museum', back_populates='objects')
    gallery = db.relationship('Gallery', back_populates='objects')
    collection = db.relationship('Collection', back_populates='objects')
    
    exhibitions = db.relationship('Exhibition', secondary=exhibition_objects, back_populates='objects')
    
    learning_resources = db.relationship('LearningResource', back_populates='object', cascade='all, delete-orphan')
    stories = db.relationship('Story', back_populates='object', cascade='all, delete-orphan')
    activities = db.relationship('Activity', back_populates='object', cascade='all, delete-orphan')
