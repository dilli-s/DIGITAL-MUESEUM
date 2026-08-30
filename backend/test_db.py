import sys
from app import create_app
from app.extensions import db
from app.models import Museum, Gallery, Collection, Exhibition, MuseumObject, LearningResource, Story, Activity, User

app = create_app()
with app.app_context():
    try:
        print("Museums:", db.session.query(Museum).count())
        print("Galleries:", db.session.query(Gallery).count())
        print("Collections:", db.session.query(Collection).count())
        print("Exhibitions:", db.session.query(Exhibition).count())
        print("Objects:", db.session.query(MuseumObject).count())
        print("Learning:", db.session.query(LearningResource).count())
        print("Stories:", db.session.query(Story).count())
        print("Activities:", db.session.query(Activity).count())
        print("Users:", db.session.query(User).count())
        print("Success")
    except Exception as e:
        print("Error:", e)
