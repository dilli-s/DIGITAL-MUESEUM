from typing import Any
from datetime import datetime, date
from sqlalchemy import Table
from app.extensions import db

class BaseModel(db.Model):
    __abstract__ = True
    __table__: Table

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def serialize(self) -> dict[str, Any]:
        result: dict[str, Any] = {}
        if not hasattr(self, "__table__"):
            return result
        for c in self.__table__.columns:
            val = getattr(self, c.name)
            if isinstance(val, (datetime, date)):
                result[c.name] = val.isoformat()
            else:
                result[c.name] = val
        return result
