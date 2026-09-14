from typing import Any
from app.extensions import db
from datetime import datetime, timezone
from app.models.base import BaseModel

class UserHistory(BaseModel):
    __tablename__ = 'user_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    content_type = db.Column(db.String(50), nullable=False, index=True) # 'object', 'learning', 'story', 'activity'
    content_id = db.Column(db.Integer, nullable=False, index=True)
    action = db.Column(db.String(50), nullable=False) # 'viewed', 'started', 'completed'
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationship
    user = db.relationship('User', backref=db.backref('history_records', cascade='all, delete-orphan'))

    def serialize(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "content_type": self.content_type,
            "content_id": self.content_id,
            "action": self.action,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
