from app.extensions import db
from datetime import datetime, timezone
from sqlalchemy import UniqueConstraint

class Bookmark(db.Model):
    __tablename__ = 'bookmarks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    content_type = db.Column(db.String(50), nullable=False, index=True) # e.g. 'object', 'learning', 'story'
    content_id = db.Column(db.Integer, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('user_id', 'content_type', 'content_id', name='uq_bookmark_user_content'),
    )

    # Relationship to user
    user = db.relationship('User', backref=db.backref('bookmarks', cascade='all, delete-orphan'))

    def serialize(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "content_type": self.content_type,
            "content_id": self.content_id,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
