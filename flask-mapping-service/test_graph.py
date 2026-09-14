from app.models.map_node import get_all_nodes
from app.models.map_edge import get_all_edges
from app.models.floor_plan import get_all_floor_plans

def get_graph_for_museum(museum_id):
    floor_plans = get_all_floor_plans(museum_id=museum_id)
    fp_ids = [fp["id"] for fp in floor_plans]
    
    nodes = get_all_nodes()
    # Filter nodes by floor_plan_id
    if fp_ids:
        nodes = [n for n in nodes if n.get("floor_plan_id") in fp_ids]
    
    node_ids = {n["id"] for n in nodes}
    edges = get_all_edges()
    # Filter edges where both from and to nodes are in the filtered nodes
    if node_ids:
        edges = [e for e in edges if e["from_node_id"] in node_ids and e["to_node_id"] in node_ids]
    
    return {"floor_plans": floor_plans, "nodes": nodes, "edges": edges}
