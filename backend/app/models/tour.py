from app.extensions import db
from datetime import datetime, timezone
from app.models.base import BaseModel


class TourNode(BaseModel):
    """
    A capture point in the virtual tour — one equirectangular 360° panorama.
    Each node represents a physical location the visitor can 'stand in'.
    """
    __tablename__ = 'tour_nodes'

    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.Integer, db.ForeignKey('museums.id'), nullable=False)
    gallery_id = db.Column(db.Integer, db.ForeignKey('galleries.id'), nullable=True)

    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)

    # Full-resolution equirectangular panorama (stored as uploaded)
    panorama_url = db.Column(db.Text, nullable=True)

    # Tiling pipeline state
    tile_status = db.Column(
        db.String(20), nullable=False, default='pending'
    )  # pending | processing | ready | failed
    tile_base_url = db.Column(db.Text, nullable=True)   # base path for tile directory
    tile_config = db.Column(db.JSON, nullable=True)     # {width, height, tileSize, levels:[{width,height,cols,rows}]}

    # Compass bearing of the panorama's "forward" direction (degrees, 0=North)
    # Used to calculate target_entry_yaw for camera continuity between rooms
    compass_bearing_ref = db.Column(db.Float, nullable=True)

    # 2D floorplan coordinates for the map overlay view (in floorplan pixel space or normalised 0-1)
    pos_x = db.Column(db.Float, nullable=True)
    pos_y = db.Column(db.Float, nullable=True)

    # Whether this node is the starting node for the museum tour
    is_start = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    outgoing_edges = db.relationship(
        'TourEdge',
        foreign_keys='TourEdge.source_node_id',
        back_populates='source_node',
        cascade='all, delete-orphan'
    )
    incoming_edges = db.relationship(
        'TourEdge',
        foreign_keys='TourEdge.target_node_id',
        back_populates='target_node',
        cascade='all, delete-orphan'
    )
    objects = db.relationship('MuseumObject', back_populates='tour_node', lazy='dynamic')

    def serialize(self):
        data = super().serialize()
        data['outgoing_edge_count'] = len(self.outgoing_edges) if self.outgoing_edges else 0
        return data

    def serialize_full(self):
        """Full serialization including edges and object stubs for the tour API."""
        data = self.serialize()
        data['edges'] = [e.serialize() for e in self.outgoing_edges]
        data['objects'] = [
            {
                'id': o.id,
                'name': o.name,
                'image': o.image,
                'category': o.category,
                'tour_yaw': o.tour_yaw,
                'tour_pitch': o.tour_pitch,
            }
            for o in self.objects
            if o.tour_yaw is not None and o.tour_pitch is not None
        ]
        return data


class TourEdge(BaseModel):
    """
    A directed connection between two TourNodes — represents a walkable path.
    The arrow marker is rendered on the source node's panorama at (yaw, pitch).
    """
    __tablename__ = 'tour_edges'

    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.Integer, db.ForeignKey('museums.id'), nullable=False)

    source_node_id = db.Column(db.Integer, db.ForeignKey('tour_nodes.id'), nullable=False)
    target_node_id = db.Column(db.Integer, db.ForeignKey('tour_nodes.id'), nullable=False)

    # Arrow marker position on source panorama (degrees; 0,0 = equator facing forward)
    yaw = db.Column(db.Float, nullable=False, default=0.0)
    pitch = db.Column(db.Float, nullable=False, default=-45.0)

    # The arrow's own rotation (degrees) — sets which way the chevron head points
    facing_yaw = db.Column(db.Float, nullable=False, default=0.0)

    # Camera yaw to apply when arriving at the target node (degrees)
    # Set this to the bearing the visitor is 'walking toward' so the transition feels continuous
    target_entry_yaw = db.Column(db.Float, nullable=False, default=0.0)

    # Optional human-readable corridor/path label (shown as floor text near the arrow)
    label = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    source_node = db.relationship(
        'TourNode',
        foreign_keys=[source_node_id],
        back_populates='outgoing_edges'
    )
    target_node = db.relationship(
        'TourNode',
        foreign_keys=[target_node_id],
        back_populates='incoming_edges'
    )

    def serialize(self):
        data = super().serialize()
        # Include target node name for display
        if self.target_node:
            data['target_node_name'] = self.target_node.name
        return data
