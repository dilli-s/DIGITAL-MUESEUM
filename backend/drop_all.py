from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    # Drop all tables in public schema
    db.session.execute(text("DROP SCHEMA public CASCADE;"))
    db.session.execute(text("CREATE SCHEMA public;"))
    db.session.execute(text("GRANT ALL ON SCHEMA public TO public;"))
    db.session.commit()
    print("Dropped and recreated public schema.")
