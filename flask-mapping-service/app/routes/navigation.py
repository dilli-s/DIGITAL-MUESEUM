from flask import Blueprint, request, jsonify
from app.models.map_node import get_all_nodes
from app.models.map_edge import get_all_edges
from app.utils.pathfinding import a_star, generate_instructions
import logging

navigation_bp = Blueprint('navigation', __name__)

@navigation_bp.route('/navigation/route', methods=['POST'])
def calculate_route():
    data = request.json
    floor_plan_id = data.get('floor_plan_id')
    start_pt = data.get('start') # {x, y}
    dest = data.get('destination') # {artifact_id} or {node_id}
    
    if not start_pt or not dest:
        return jsonify({"error": "Missing start or destination"}), 400
        
    try:
        nodes = get_all_nodes(floor_plan_id=floor_plan_id)
        all_edges = get_all_edges()
        
        if not nodes:
            return jsonify({"error": "No map data for this floor"}), 404
            
        nodes_dict = {str(n['id']): n for n in nodes}
        edges = [e for e in all_edges if str(e['from_node_id']) in nodes_dict and str(e['to_node_id']) in nodes_dict]
        
        # 1. Snap start point to nearest node
        def dist_sq(x1, y1, n):
            nx = n.get('x_coordinate', 0)
            ny = n.get('y_coordinate', 0)
            return (x1 - nx)**2 + (y1 - ny)**2
            
        start_node_id = min(nodes, key=lambda n: dist_sq(start_pt['x'], start_pt['y'], n))['id']
        
        # 2. Find destination node
        dest_node_id = None
        if 'node_id' in dest:
            dest_node_id = dest['node_id']
        elif 'artifact_id' in dest:
            from app.models.artifact import get_artifact
            art = get_artifact(dest['artifact_id'])
            if not art:
                return jsonify({"error": "Artifact not found"}), 404
            dest_node_id = min(nodes, key=lambda n: dist_sq(art.get('map_x', 0), art.get('map_y', 0), n))['id']
            
        if not dest_node_id or str(dest_node_id) not in nodes_dict:
             return jsonify({"error": "Destination node could not be resolved"}), 400
             
        # 3. Pathfind
        path, distance, time_s = a_star(str(start_node_id), str(dest_node_id), nodes_dict, edges)
        
        if not path:
             return jsonify({"error": "No route found"}), 404
             
        instructions = generate_instructions(path)
        
        return jsonify({
            "success": True,
            "route": path,
            "distance_m": round(distance, 1),
            "estimated_time_s": int(time_s),
            "instructions": instructions
        }), 200
        
    except Exception as e:
        logging.error(f"Error calculating route: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
