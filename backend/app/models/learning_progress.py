from app.extensions import db
from datetime import datetime, timezone
from sqlalchemy import UniqueConstraint

class LearningProgress(db.Model):
    __tablename__ = 'learning_progress'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    learning_id = db.Column(db.Integer, db.ForeignKey('learning_resources.id'), nullable=False, index=True)
    
    status = db.Column(db.String(50), nullable=False, default='not_started') # 'not_started', 'in_progress', 'completed'
    progress = db.Column(db.Integer, nullable=False, default=0) # 0 to 100
    
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('user_id', 'learning_id', name='uq_learning_progress_user'),
    )

    # Relationships
    user = db.relationship('User', backref=db.backref('learning_progress', cascade='all, delete-orphan'))
    learning = db.relationship('LearningResource', backref=db.backref('progress_records', cascade='all, delete-orphan'))

    def serialize(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "learning_id": self.learning_id,
            "status": self.status,
            "progress": self.progress,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
