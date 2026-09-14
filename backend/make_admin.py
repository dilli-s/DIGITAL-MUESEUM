import getpass

from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

with app.app_context():
    email = input("Admin email [test_activity@example.com]: ").strip()
    email = email or "test_activity@example.com"
    name = input("Admin name [Administrator]: ").strip() or "Administrator"
    password = getpass.getpass("Admin password: ")

    if not password:
        raise SystemExit("Password cannot be empty.")

    user = User.query.filter_by(email=email).first()
    if user is None:
        user = User(name=name, email=email, role="admin")
        db.session.add(user)
    else:
        user.name = name
        user.role = "admin"

    user.set_password(password)
    db.session.commit()
    print(f"Admin account ready: {email}")
