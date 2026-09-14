from typing import Any
from app.extensions import db
from datetime import datetime, timezone
from sqlalchemy import UniqueConstraint
from app.models.base import BaseModel

class ActivityProgress(BaseModel):
    __tablename__ = 'activity_progress'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('activities.id'), nullable=False, index=True)
    
    status = db.Column(db.String(50), nullable=False, default='not_started') # 'not_started', 'started', 'completed'
    score = db.Column(db.Integer, nullable=True) 
    completed = db.Column(db.Boolean, default=False)
    
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('user_id', 'activity_id', name='uq_activity_progress_user'),
    )

    # Relationships
    user = db.relationship('User', backref=db.backref('activity_progress', cascade='all, delete-orphan'))
    activity = db.relationship('Activity', backref=db.backref('progress_records', cascade='all, delete-orphan'))

    def serialize(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "activity_id": self.activity_id,
            "status": self.status,
            "score": self.score,
            "completed": self.completed,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
