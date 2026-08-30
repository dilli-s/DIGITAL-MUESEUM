from app.extensions import db
from datetime import datetime, timezone

class Gallery(db.Model):
    __tablename__ = 'galleries'

    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.Integer, db.ForeignKey('museums.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image = db.Column(db.Text, nullable=True)
    floor = db.Column(db.String(50), nullable=True, default='Ground Floor')
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    museum = db.relationship('Museum', back_populates='galleries')
    objects = db.relationship('MuseumObject', back_populates='gallery')
