from functools import wraps
from flask import jsonify
from flask_login import current_user

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"error": {"code": "UNAUTHORIZED", "message": "You must be logged in to access this resource."}}), 401
        
        if current_user.role != 'admin':
            return jsonify({"error": {"code": "FORBIDDEN", "message": "You do not have permission to access this area."}}), 403
            
        return f(*args, **kwargs)
    return decorated_function
