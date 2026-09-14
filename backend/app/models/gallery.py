from typing import Any
from app.extensions import db
from datetime import datetime, timezone
from app.models.base import BaseModel

class Gallery(BaseModel):
    __tablename__ = 'galleries'

    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.Integer, db.ForeignKey('museums.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image = db.Column(db.Text, nullable=True)
    floor = db.Column(db.String(50), nullable=True, default='Ground Floor')
    boundary_polygon = db.Column(db.JSON, nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    museum = db.relationship('Museum', back_populates='galleries')
    objects = db.relationship('MuseumObject', back_populates='gallery')

    def serialize(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "museum_id": self.museum_id,
            "name": self.name,
            "description": self.description,
            "image": self.image,
            "floor": self.floor,
            "boundary_polygon": self.boundary_polygon,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
