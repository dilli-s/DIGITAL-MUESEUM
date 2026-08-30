from flask import Blueprint, jsonify, request
import logging
import os
import uuid
from werkzeug.utils import secure_filename
from app.models.map_node import get_all_nodes, create_node, get_node_by_id, update_node
from app.models.map_edge import get_all_edges, create_edge
from app.models.floor_plan import get_all_floor_plans, get_floor_plan_by_id, create_floor_plan, update_floor_plan, delete_floor_plan
from app.utils.pathfinding import find_shortest_path, get_nearby_nodes
from app.utils.geo import pixel_to_latlng

map_bp = Blueprint('map', __name__)

# --- FLOOR PLANS ---

@map_bp.route('/floor-plans', methods=['GET'])
def list_floor_plans():
    try:
        plans = get_all_floor_plans()
        return jsonify({"data": plans}), 200
    except Exception as e:
        logging.error(f"Error listing floor plans: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/floor-plans/<plan_id>', methods=['GET'])
def get_floor_plan(plan_id):
    try:
        plan = get_floor_plan_by_id(plan_id)
        if not plan:
            return jsonify({"error": "Floor plan not found"}), 404
        return jsonify({"data": plan}), 200
    except Exception as e:
        logging.error(f"Error getting floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/floor-plans', methods=['POST'])
def add_floor_plan():
    try:
        data = request.get_json()
        required_fields = ['name', 'floor_number']
        if not data or not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
            
        plan = create_floor_plan(
            name=data['name'],
            floor_number=data['floor_number'],
            image_url=data.get('image_url'),
            width_px=data.get('width_px'),
            height_px=data.get('height_px'),
            scale_meters_per_px=data.get('scale_meters_per_px'),
            is_outdoor=data.get('is_outdoor', False)
        )
        return jsonify({"data": plan}), 201
    except Exception as e:
        logging.error(f"Error creating floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/floor-plans/<plan_id>', methods=['PATCH'])
def edit_floor_plan(plan_id):
    try:
        data = request.get_json()
        plan = update_floor_plan(plan_id, data)
        if not plan:
            return jsonify({"error": "Floor plan not found"}), 404
        return jsonify({"data": plan}), 200
    except Exception as e:
        logging.error(f"Error updating floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/floor-plans/<plan_id>/georeference', methods=['PUT'])
def georeference_floor_plan(plan_id):
    try:
        data = request.get_json()
        required = ['anchor_1_x_px', 'anchor_1_y_px', 'anchor_1_lat', 'anchor_1_lng',
                    'anchor_2_x_px', 'anchor_2_y_px', 'anchor_2_lat', 'anchor_2_lng']
        if not data or not all(field in data for field in required):
            return jsonify({"error": "Missing required georeferencing fields"}), 400
            
        plan = update_floor_plan(plan_id, data)
        if not plan:
            return jsonify({"error": "Floor plan not found"}), 404
        return jsonify({"data": plan, "message": "Georeferenced successfully"}), 200
    except Exception as e:
        logging.error(f"Error georeferencing floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/floor-plans/<plan_id>', methods=['DELETE'])
def remove_floor_plan(plan_id):
    try:
        success = delete_floor_plan(plan_id)
        if not success:
            return jsonify({"error": "Floor plan not found"}), 404
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.error(f"Error deleting floor plan: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

# --- UPLOAD MAP ---

@map_bp.route('/upload-map', methods=['POST'])
def upload_map():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        if file:
            filename = secure_filename(file.filename)
            ext = os.path.splitext(filename)[1]
            unique_filename = f"{uuid.uuid4().hex}{ext}"
            
            upload_dir = os.path.join(os.getcwd(), 'uploads')
            os.makedirs(upload_dir, exist_ok=True)
            
            file_path = os.path.join(upload_dir, unique_filename)
            file.save(file_path)
            
            # Since this is local, we return a mock URL that would ideally point to a static route
            # For simplicity, returning a local path. Real implementation should use S3/R2.
            url = f"/api/static/uploads/{unique_filename}"
            return jsonify({"url": url}), 201
    except Exception as e:
        logging.error(f"Error uploading file: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

# --- NODES & EDGES ---

@map_bp.route('/nodes', methods=['GET'])
def list_nodes():
    try:
        floor = request.args.get('floor', type=int)
        floor_plan_id = request.args.get('floor_plan_id')
        nodes = get_all_nodes(floor_plan_id, floor)
        return jsonify({"data": nodes}), 200
    except Exception as e:
        logging.error(f"Error listing nodes: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/nodes/<node_id>', methods=['GET'])
def get_node(node_id):
    try:
        node = get_node_by_id(node_id)
        if not node:
            return jsonify({"error": "Node not found"}), 404
        return jsonify({"data": node}), 200
    except Exception as e:
        logging.error(f"Error getting node: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/nodes', methods=['POST'])
def add_node():
    try:
        data = request.get_json()
        
        required_fields = ['name', 'floor', 'x_coordinate', 'y_coordinate', 'node_type']
        if not data or not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
            
        node_type = data['node_type']
        valid_types = ['exhibit', 'junction', 'entrance', 'exit', 'amenity', 'restroom', 'cafe', 'giftshop', 'elevator', 'stairs']
        if node_type not in valid_types:
            return jsonify({"error": "Invalid node_type"}), 400
            
        lat, lng = data.get('latitude'), data.get('longitude')
        floor_plan_id = data.get('floor_plan_id')
        
        # Auto-compute lat/lng if floor_plan has anchors and not provided
        if floor_plan_id and (lat is None or lng is None):
            plan = get_floor_plan_by_id(floor_plan_id)
            if plan and plan.get('anchor_1_lat'):
                c_lat, c_lng = pixel_to_latlng(data['x_coordinate'], data['y_coordinate'], plan)
                if c_lat and c_lng:
                    lat, lng = c_lat, c_lng
            
        node = create_node(
            name=data['name'],
            floor=data['floor'],
            x=data['x_coordinate'],
            y=data['y_coordinate'],
            node_type=node_type,
            floor_plan_id=floor_plan_id,
            object_id=data.get('object_id'),
            latitude=lat,
            longitude=lng
        )
        
        return jsonify({"data": node}), 201
        
    except Exception as e:
        logging.error(f"Error creating node: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/nodes/<node_id>', methods=['PUT'])
def edit_node(node_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing required fields"}), 400
            
        # If coordinates or floor plan are changing, we should recompute lat/lng if not directly provided
        node = get_node_by_id(node_id)
        if not node:
            return jsonify({"error": "Node not found"}), 404
            
        floor_plan_id = data.get('floor_plan_id', node.get('floor_plan_id'))
        x = data.get('x_coordinate', node.get('x_coordinate'))
        y = data.get('y_coordinate', node.get('y_coordinate'))
        lat = data.get('latitude')
        lng = data.get('longitude')
        
        if floor_plan_id and (lat is None or lng is None):
            plan = get_floor_plan_by_id(floor_plan_id)
            if plan and plan.get('anchor_1_lat'):
                c_lat, c_lng = pixel_to_latlng(x, y, plan)
                if c_lat and c_lng:
                    data['latitude'] = c_lat
                    data['longitude'] = c_lng
                    
        updated_node = update_node(node_id, data)
        return jsonify({"data": updated_node}), 200
    except Exception as e:
        logging.error(f"Error updating node: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/edges', methods=['GET'])
def list_edges():
    try:
        edges = get_all_edges()
        return jsonify({"data": edges}), 200
    except Exception as e:
        logging.error(f"Error listing edges: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/edges', methods=['POST'])
def add_edge():
    try:
        data = request.get_json()
        
        required_fields = ['from_node_id', 'to_node_id', 'distance']
        if not data or not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
            
        from_node = get_node_by_id(data['from_node_id'])
        to_node = get_node_by_id(data['to_node_id'])
        
        if not from_node or not to_node:
            return jsonify({"error": "One or both nodes not found"}), 404
            
        if from_node['floor'] != to_node['floor']:
            valid_transition = from_node['node_type'] in ['elevator', 'stairs'] or to_node['node_type'] in ['elevator', 'stairs']
            if not valid_transition:
                return jsonify({"error": "Cross-floor edges must connect to an elevator or stairs node"}), 400
            
        walkable = data.get('walkable', True)
        
        edge = create_edge(
            from_node_id=data['from_node_id'],
            to_node_id=data['to_node_id'],
            distance=data['distance'],
            walkable=walkable
        )
        
        return jsonify({"data": edge}), 201
        
    except Exception as e:
        logging.error(f"Error creating edge: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

# --- ROUTING & PATHFINDING ---

@map_bp.route('/route', methods=['GET'])
def get_route():
    try:
        from_id = request.args.get('from')
        to_id = request.args.get('to')
        
        if not from_id or not to_id:
            return jsonify({"error": "Missing 'from' or 'to' query parameters"}), 400
            
        from_node = get_node_by_id(from_id)
        to_node = get_node_by_id(to_id)
        
        if not from_node or not to_node:
            return jsonify({"error": "One or both nodes not found"}), 404
            
        nodes = get_all_nodes()
        nodes_dict = {str(n['id']): n for n in nodes}
        edges = get_all_edges()
        
        path, total_distance, instructions = find_shortest_path(from_id, to_id, nodes_dict, edges)
        
        if not path:
            return jsonify({
                "message": "No walkable route exists between these nodes",
                "path": [],
                "distance": 0,
                "instructions": []
            }), 200
            
        return jsonify({
            "path": path,
            "distance": total_distance,
            "instructions": instructions
        }), 200
        
    except Exception as e:
        logging.error(f"Error finding route: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/nodes/nearby', methods=['GET'])
def get_nearby():
    try:
        node_id = request.args.get('node_id')
        hops = request.args.get('hops', type=int)
        radius = request.args.get('radius', type=float)
        
        if not node_id:
            return jsonify({"error": "Missing 'node_id' query parameter"}), 400
            
        if hops is None and radius is None:
            hops = 3 # Default to 3 hops
            
        nodes = get_all_nodes()
        nodes_dict = {str(n['id']): n for n in nodes}
        edges = get_all_edges()
        
        nearby = get_nearby_nodes(node_id, radius_meters=radius, hops=hops, nodes_dict=nodes_dict, edges_list=edges)
        return jsonify({"data": nearby}), 200
    except Exception as e:
        logging.error(f"Error finding nearby nodes: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@map_bp.route('/graph', methods=['GET'])
def get_graph():
    try:
        floor_plans = get_all_floor_plans()
        nodes = get_all_nodes()
        edges = get_all_edges()
        
        return jsonify({
            "floor_plans": floor_plans,
            "nodes": nodes,
            "edges": edges
        }), 200
    except Exception as e:
        logging.error(f"Error getting graph: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

# Also serve static files from uploads
from flask import send_from_directory
import os

@map_bp.route('/static/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    upload_dir = os.path.join(os.getcwd(), 'uploads')
    return send_from_directory(upload_dir, filename)
