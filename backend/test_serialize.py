import sys
from app import create_app
from app.extensions import db
from app.models import Collection

def serialize(self):
    from datetime import datetime
    result = {}
    for c in self.__table__.columns:
        val = getattr(self, c.name)
        if isinstance(val, datetime):
            result[c.name] = val.isoformat()
        else:
            result[c.name] = val
    return result

db.Model.serialize = serialize

app = create_app()
with app.app_context():
    try:
        c = Collection.query.first()
        if c:
            print("Collection:", c.serialize())
        else:
            print("No collections.")
    except Exception as e:
        print("Error:", e)
