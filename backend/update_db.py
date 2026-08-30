from app import create_app, db
from app.models.object import MuseumObject
app = create_app()
with app.app_context():
    # We can just run raw SQL since we might not have a migration for it ready yet,
    # or better, let's generate an alembic migration.
    pass
