import os
import math
from app import create_app
from app.utils.db import execute_query
from app.utils.geo import haversine_distance

def audit_nodes():
    print("--- AUDITING NODES ---")
    query = "SELECT id, name, latitude, longitude FROM map_nodes"
    nodes = execute_query(query, fetch=True)
    
    flagged = []
    for row in nodes:
        node_id, name, lat, lng = row
        if lat is None or lng is None:
            flagged.append(f"Node {name} ({node_id}) has missing coordinates: lat={lat}, lng={lng}")
        elif lat == 0.0 and lng == 0.0:
            flagged.append(f"Node {name} ({node_id}) has placeholder (0,0) coordinates")
        elif abs(lat) > 90 or abs(lng) > 180:
            flagged.append(f"Node {name} ({node_id}) has out-of-bounds coordinates: lat={lat}, lng={lng}")
            
    if flagged:
        print("WARNING: The following nodes have suspicious coordinates:")
        for msg in flagged:
            print(" -", msg)
    else:
        print("All nodes appear to have valid, non-zero coordinates.")
    print("")

def recompute_edges():
    print("--- RECOMPUTING EDGE DISTANCES ---")
    
    # Get all nodes in a dictionary
    nodes = execute_query("SELECT id, latitude, longitude FROM map_nodes", fetch=True)
    node_dict = {str(n[0]): {'lat': n[1], 'lng': n[2]} for n in nodes}
    
    edges = execute_query("SELECT id, from_node_id, to_node_id, distance FROM map_edges", fetch=True)
    
    updates = 0
    for edge in edges:
        edge_id = str(edge[0])
        from_id = str(edge[1])
        to_id = str(edge[2])
        current_distance = float(edge[3]) if edge[3] is not None else 0.0
        
        from_node = node_dict.get(from_id)
        to_node = node_dict.get(to_id)
        
        if not from_node or not to_node:
            print(f"Skipping edge {edge_id}: One or both nodes not found.")
            continue
            
        lat1, lng1 = from_node.get('lat'), from_node.get('lng')
        lat2, lng2 = to_node.get('lat'), to_node.get('lng')
        
        if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
            print(f"Skipping edge {edge_id}: Missing coordinates on connected nodes.")
            continue
            
        real_dist = haversine_distance(lat1, lng1, lat2, lng2)
        
        # Check if difference is greater than 1 meter
        if abs(current_distance - real_dist) > 1.0:
            print(f"Updating edge {edge_id}: {current_distance:.2f}m -> {real_dist:.2f}m")
            execute_query(
                "UPDATE map_edges SET distance = %s WHERE id = %s",
                (real_dist, edge_id),
                commit=True
            )
            updates += 1
            
    print(f"Finished recomputing edges. Updated {updates} edges.")

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        audit_nodes()
        recompute_edges()
