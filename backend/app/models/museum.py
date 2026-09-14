from app.extensions import db
from datetime import datetime, timezone
from app.models.base import BaseModel

class Museum(BaseModel):
    __tablename__ = 'museums'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    location = db.Column(db.String(255), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    image = db.Column(db.Text, nullable=True)
    
    # Indoor Mapping Facility Coordinates
    entrance_lat = db.Column(db.Float, nullable=True)
    entrance_lng = db.Column(db.Float, nullable=True)
    exit_lat = db.Column(db.Float, nullable=True)
    exit_lng = db.Column(db.Float, nullable=True)
    washroom_lat = db.Column(db.Float, nullable=True)
    washroom_lng = db.Column(db.Float, nullable=True)
    cafe_lat = db.Column(db.Float, nullable=True)
    cafe_lng = db.Column(db.Float, nullable=True)
    
    # Pathing Network Graph (Nodes and Edges for True Pathfinding)
    pathing_graph = db.Column(db.JSON, nullable=True)
    
    # Custom Floorplan Overlay
    floorplan_image = db.Column(db.Text, nullable=True)
    bounds_tl_lat = db.Column(db.Float, nullable=True)
    bounds_tl_lng = db.Column(db.Float, nullable=True)
    bounds_br_lat = db.Column(db.Float, nullable=True)
    bounds_br_lng = db.Column(db.Float, nullable=True)
    
    opening_hours = db.Column(db.String(255), nullable=True)
    contact_email = db.Column(db.String(255), nullable=True)
    contact_phone = db.Column(db.String(255), nullable=True)
    wheelchair_access = db.Column(db.Boolean, default=False)
    info_desk = db.Column(db.Boolean, default=False)
    cafe_restrooms = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    galleries = db.relationship('Gallery', back_populates='museum', cascade='all, delete-orphan')
    collections = db.relationship('Collection', back_populates='museum', cascade='all, delete-orphan')
    exhibitions = db.relationship('Exhibition', back_populates='museum', cascade='all, delete-orphan')
    objects = db.relationship('MuseumObject', back_populates='museum', cascade='all, delete-orphan')
