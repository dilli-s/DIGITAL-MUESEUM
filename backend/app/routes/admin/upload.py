from flask import Blueprint, request, jsonify
from app.utils.decorators import admin_required
import os
import uuid
from werkzeug.utils import secure_filename

admin_upload_bp = Blueprint('admin_upload', __name__)

@admin_upload_bp.route('/upload', methods=['POST'])
@admin_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No file uploaded"}}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No selected file"}}), 400
    
    if file:
        filename = secure_filename(file.filename)
        ext = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        
        # Ensure uploads dir exists in backend root
        upload_folder = os.path.join(os.getcwd(), 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)
        
        # We will serve this via a route in __init__.py
        backend_url = request.host_url.rstrip('/')
        file_url = f"{backend_url}/uploads/{unique_filename}"
        
        return jsonify({
            "data": {
                "url": file_url,
                "filename": unique_filename
            }
        })
