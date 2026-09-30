from flask import Blueprint, request, jsonify, current_app
from app.utils.decorators import admin_required
import os
import uuid
from werkzeug.utils import secure_filename

admin_upload_bp = Blueprint('admin_upload', __name__)


def _get_upload_folder():
    """Return the absolute path to the uploads directory."""
    return os.path.join(os.getcwd(), 'uploads')


@admin_upload_bp.route('/upload', methods=['POST'])
@admin_required
def upload_file():
    """
    General-purpose file upload.
    Returns the URL of the uploaded file.
    """
    if 'file' not in request.files:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No file uploaded"}}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No selected file"}}), 400

    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{ext}"

    upload_folder = _get_upload_folder()
    os.makedirs(upload_folder, exist_ok=True)

    file_path = os.path.join(upload_folder, unique_filename)
    file.save(file_path)

    backend_url = request.host_url.rstrip('/')
    file_url = f"{backend_url}/uploads/{unique_filename}"

    return jsonify({
        "data": {
            "url": file_url,
            "filename": unique_filename
        }
    })


@admin_upload_bp.route('/upload/panorama/<int:node_id>', methods=['POST'])
@admin_required
def upload_panorama(node_id):
    """
    Upload a full-resolution equirectangular panorama for a TourNode.
    Saves the file, updates node.panorama_url, then triggers async tiling.
    Returns immediately — tile_status will be 'processing' until tiling completes.
    """
    from app.models.tour import TourNode
    from app.extensions import db

    node = db.session.get(TourNode, node_id)
    if not node:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourNode not found"}}), 404

    if 'file' not in request.files:
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No file uploaded"}}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "No selected file"}}), 400

    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1].lower()

    # Only accept image types
    if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'):
        return jsonify({"error": {"code": "INVALID_FILE_TYPE", "message": "Only image files are accepted for panoramas"}}), 400

    unique_filename = f"panorama_node_{node_id}_{uuid.uuid4().hex}{ext}"
    upload_folder = _get_upload_folder()
    os.makedirs(upload_folder, exist_ok=True)

    file_path = os.path.join(upload_folder, unique_filename)
    file.save(file_path)

    backend_url = request.host_url.rstrip('/')
    file_url = f"{backend_url}/uploads/{unique_filename}"

    # Update node with panorama URL and reset tile status
    node.panorama_url = file_url
    node.tile_status = 'pending'
    node.tile_base_url = None
    node.tile_config = None
    db.session.commit()

    # Kick off async tiling
    try:
        from app.services.panorama_tiler import tile_panorama_async
        app = current_app._get_current_object()
        tile_panorama_async(file_path, node_id, app=app)
        node.tile_status = 'processing'
        db.session.commit()
    except Exception as e:
        # Non-fatal: tiling will be in 'pending' state, admin can retile manually
        import logging
        logging.getLogger(__name__).warning(f"Could not start tiling for node {node_id}: {e}")

    return jsonify({
        "data": {
            "url": file_url,
            "filename": unique_filename,
            "node_id": node_id,
            "tile_status": node.tile_status,
        }
    })


@admin_upload_bp.route('/upload/panorama/<int:node_id>/retile', methods=['POST'])
@admin_required
def retile_panorama(node_id):
    """
    Manually trigger re-tiling for a node that already has a panorama_url.
    Useful if tiling previously failed or a new panorama was uploaded externally.
    """
    from app.models.tour import TourNode
    from app.extensions import db

    node = db.session.get(TourNode, node_id)
    if not node:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourNode not found"}}), 404

    if not node.panorama_url:
        return jsonify({"error": {"code": "NO_PANORAMA", "message": "No panorama uploaded yet for this node"}}), 400

    # Derive local file path from URL
    panorama_filename = node.panorama_url.split('/uploads/')[-1]
    file_path = os.path.join(_get_upload_folder(), panorama_filename)

    if not os.path.exists(file_path):
        return jsonify({"error": {"code": "FILE_NOT_FOUND", "message": f"Panorama file not found on disk: {panorama_filename}"}}), 404

    node.tile_status = 'processing'
    db.session.commit()

    try:
        from app.services.panorama_tiler import tile_panorama_async
        app = current_app._get_current_object()
        tile_panorama_async(file_path, node_id, app=app)
    except Exception as e:
        node.tile_status = 'failed'
        db.session.commit()
        return jsonify({"error": {"code": "TILING_ERROR", "message": str(e)}}), 500

    return jsonify({
        "data": {
            "node_id": node_id,
            "tile_status": "processing",
            "message": "Tiling started in background"
        }
    })
