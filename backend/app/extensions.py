from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager

db = SQLAlchemy()

def serialize(self):
    from datetime import datetime, date
    result = {}
    for c in self.__table__.columns:
        val = getattr(self, c.name)
        if isinstance(val, (datetime, date)):
            result[c.name] = val.isoformat()
        else:
            result[c.name] = val
    return result

db.Model.serialize = serialize

migrate = Migrate()
login_manager = LoginManager()
