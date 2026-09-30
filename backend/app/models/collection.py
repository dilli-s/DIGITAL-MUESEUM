from app.extensions import db
from datetime import datetime, timezone
from app.models.base import BaseModel

class Collection(BaseModel):
    __tablename__ = 'collections'

    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.Integer, db.ForeignKey('museums.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    museum = db.relationship('Museum', back_populates='collections')
    objects = db.relationship('MuseumObject', back_populates='collection')

    def serialize(self):
        obj_count = len(self.objects) if hasattr(self, 'objects') and self.objects else 0
        return {
            "id": self.id,
            "museum_id": self.museum_id,
            "museum": {
                "id": self.museum.id,
                "name": self.museum.name,
                "location": self.museum.location,
                "image": self.museum.image
            } if self.museum else None,
            "museum_name": self.museum.name if self.museum else None,
            "museum_location": self.museum.location if self.museum else None,
            "museum_image": self.museum.image if self.museum else None,
            "name": self.name,
            "description": self.description,
            "image": self.image,
            "objectCount": obj_count,
            "object_count": obj_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
