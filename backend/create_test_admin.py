from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

with app.app_context():
    # Check if user already exists
    user = User.query.filter_by(email="test_activity@example.com").first()
    if not user:
        user = User(email="test_activity@example.com", name="Test Admin", role="admin")
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        print("Created test_activity@example.com as an admin.")
    else:
        user.role = "admin"
        user.set_password("password123")
        db.session.commit()
        print("Updated test_activity@example.com to admin and reset password.")
