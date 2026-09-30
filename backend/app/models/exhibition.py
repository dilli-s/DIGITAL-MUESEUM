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

    def serialize(self):
        obj_count = len(self.objects) if hasattr(self, 'objects') and self.objects else 0
        obj_ids = [o.id for o in self.objects] if hasattr(self, 'objects') and self.objects else []
        return {
            "id": self.id,
            "museum_id": self.museum_id,
            "museum": {
                "id": self.museum.id,
                "name": self.museum.name,
                "location": self.museum.location,
                "latitude": self.museum.latitude,
                "longitude": self.museum.longitude,
                "image": self.museum.image
            } if self.museum else None,
            "museum_name": self.museum.name if self.museum else None,
            "museum_location": self.museum.location if self.museum else None,
            "museum_latitude": self.museum.latitude if self.museum else None,
            "museum_longitude": self.museum.longitude if self.museum else None,
            "title": self.title,
            "subtitle": self.subtitle,
            "description": self.description,
            "long_description": self.long_description,
            "image": self.image,
            "category": self.category,
            "theme": self.theme,
            "period": self.period,
            "location": self.location,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "endDate": self.end_date.isoformat() if self.end_date else None,
            "featured": self.featured,
            "objectCount": obj_count,
            "object_count": obj_count,
            "objectIds": obj_ids,
            "object_ids": obj_ids,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
