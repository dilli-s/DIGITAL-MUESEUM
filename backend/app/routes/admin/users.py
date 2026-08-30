from flask import Blueprint, jsonify, request
from app.extensions import db
from app.models import User
from app.utils.decorators import admin_required

admin_users_bp = Blueprint('admin_users', __name__)

@admin_users_bp.route('', methods=['GET'], strict_slashes=False)
@admin_required
def get_users():
    users = User.query.all()
    return jsonify({"data": [u.serialize() for u in users]}), 200

@admin_users_bp.route('', methods=['POST'], strict_slashes=False)
@admin_required
def create_user():
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data or 'name' not in data:
        return jsonify({"error": {"message": "Email, password, and name are required."}}), 400
        
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": {"message": "Email already exists."}}), 400

    new_user = User(
        name=data['name'],
        email=data['email'],
        role=data.get('role', 'user')
    )
    new_user.set_password(data['password'])
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({"data": new_user.serialize()}), 201

@admin_users_bp.route('/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    if 'name' in data:
        user.name = data['name']
    if 'email' in data:
        existing = User.query.filter_by(email=data['email']).first()
        if existing and existing.id != user_id:
            return jsonify({"error": {"message": "Email already exists."}}), 400
        user.email = data['email']
    if 'role' in data:
        user.role = data['role']
    if 'password' in data and data['password'].strip():
        user.set_password(data['password'])
        
    db.session.commit()
    return jsonify({"data": user.serialize()}), 200

@admin_users_bp.route('/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    # Prevent admin from deleting themselves
    from flask_login import current_user
    if user.id == current_user.id:
        return jsonify({"error": {"message": "You cannot delete your own account."}}), 400
        
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted successfully"}), 200
