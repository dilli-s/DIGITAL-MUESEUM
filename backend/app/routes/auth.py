from flask import Blueprint, jsonify, request
from app.models.user import User
from app.extensions import db
from flask_login import login_user, logout_user, current_user, login_required
import re

auth_bp = Blueprint('auth', __name__)

def is_valid_email(email):
    pattern = r"^[\w\.\+\-]+\@[\w\.\+\-]+\.[a-zA-Z0-9]+$"
    return re.match(pattern, email) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": {"code": "BAD_REQUEST", "message": "Invalid request"}}), 400

        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not name:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Name is required."}}), 400
        
        if not email or not is_valid_email(email):
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "A valid email is required."}}), 400

        if not password or len(password) < 8:
            return jsonify({"error": {"code": "VALIDATION_ERROR", "message": "Password must be at least 8 characters long."}}), 400

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({"error": {"code": "EMAIL_EXISTS", "message": "An account with this email already exists."}}), 409

        new_user = User(name=name, email=email)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()

        # Login immediately after registration if desired, or just return user
        return jsonify({"data": {"user": new_user.serialize()}}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": {"code": "BAD_REQUEST", "message": "Invalid request"}}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return jsonify({"error": {"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."}}), 401

        login_user(user)

        return jsonify({"data": {"user": user.serialize()}})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    try:
        logout_user()
        return jsonify({"data": {"message": "Logged out successfully."}})
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "An error occurred"}}), 500

@auth_bp.route('/me', methods=['GET'])
def current_user_info():
    if current_user.is_authenticated:
        return jsonify({"data": {"user": current_user.serialize()}})
    else:
        return jsonify({"error": {"code": "UNAUTHORIZED", "message": "Not authenticated"}}), 401

@auth_bp.route('/test-protected', methods=['GET'])
@login_required
def test_protected():
    return jsonify({"data": {"message": "You accessed a protected route!"}})
