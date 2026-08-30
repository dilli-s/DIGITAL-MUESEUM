from app import create_app
from app.models.floor_plan import create_floor_plan
from app.models.map_node import create_node
from app.models.map_edge import create_edge
from app.utils.pathfinding import get_nearby_nodes, find_shortest_path
import json

app = create_app()
with app.app_context():
    # 1. Create floor plan
    fp = create_floor_plan("Ground Floor", 0, "/api/static/uploads/test.jpg", 1000, 1000, 1.0, False)
    fp_id = fp['id']
    print(f"Created floor plan: {fp_id}")
    
    # 2. Create nodes
    n1 = create_node("Entrance", 0, 100, 100, "entrance", fp_id)
    n2 = create_node("Junction 1", 0, 500, 100, "junction", fp_id)
    n3 = create_node("Exhibit A", 0, 500, 500, "exhibit", fp_id)
    n4 = create_node("Restroom", 0, 900, 100, "restroom", fp_id)
    
    print(f"Created nodes: {n1['id']}, {n2['id']}, {n3['id']}, {n4['id']}")
    
    # 3. Create edges
    create_edge(n1['id'], n2['id'], 400.0)
    create_edge(n2['id'], n3['id'], 400.0)
    create_edge(n2['id'], n4['id'], 400.0)
    
    # 4. Nearby
    nearby = get_nearby_nodes(n1['id'], hops=2)
    print("Nearby nodes (hops=2) from Entrance:")
    for n in nearby:
        print(f"  - {n['name']} ({n['node_type']})")
        
    # 5. Route
    path, dist, inst = find_shortest_path(n1['id'], n3['id'])
    print(f"Route from Entrance to Exhibit A (dist={dist}):")
    print(f"  Path: {[n['name'] for n in path]}")
    print(f"  Instructions:")
    for i in inst:
        print(f"    {i}")

