from app import create_app
from app.extensions import db
from app.models import MuseumObject

app = create_app()
with app.app_context():
    objects = MuseumObject.query.filter_by(model_3d_url="https://modelviewer.dev/shared-assets/models/Astronaut.glb").all()
    for obj in objects:
        obj.model_3d_url = None
    db.session.commit()
    print(f"Fixed {len(objects)} objects")
