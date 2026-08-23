from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

with app.app_context():
    # Make test_activity@example.com an admin
    user = User.query.filter_by(email="test_activity@example.com").first()
    if user:
        user.role = 'admin'
        db.session.commit()
        print("Updated test_activity@example.com to admin.")
    else:
        print("User not found.")
