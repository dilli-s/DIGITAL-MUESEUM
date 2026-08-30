import requests

BASE_URL = "http://localhost:5001/api"

nodes_data = [
    {"name": "Entrance", "floor": 1, "x_coordinate": 50, "y_coordinate": 90, "node_type": "entrance"},
    {"name": "Junction A", "floor": 1, "x_coordinate": 50, "y_coordinate": 50, "node_type": "junction"},
    {"name": "Exhibit 1", "floor": 1, "x_coordinate": 20, "y_coordinate": 50, "node_type": "exhibit"},
    {"name": "Exhibit 2", "floor": 1, "x_coordinate": 80, "y_coordinate": 50, "node_type": "exhibit"},
    {"name": "Exit", "floor": 1, "x_coordinate": 50, "y_coordinate": 10, "node_type": "exit"}
]

print("Creating nodes...")
nodes = []
for data in nodes_data:
    resp = requests.post(f"{BASE_URL}/nodes", json=data)
    node = resp.json()['data']
    nodes.append(node)
    print(f"Created node {node['name']} with ID {node['id']}")

edges_data = [
    {"from_node_id": nodes[0]['id'], "to_node_id": nodes[1]['id'], "distance": 40},
    {"from_node_id": nodes[1]['id'], "to_node_id": nodes[2]['id'], "distance": 30},
    {"from_node_id": nodes[1]['id'], "to_node_id": nodes[3]['id'], "distance": 30},
    {"from_node_id": nodes[1]['id'], "to_node_id": nodes[4]['id'], "distance": 40},
    {"from_node_id": nodes[2]['id'], "to_node_id": nodes[4]['id'], "distance": 50},
]

print("\nCreating edges...")
for data in edges_data:
    resp = requests.post(f"{BASE_URL}/edges", json=data)
    print(f"Created edge from {data['from_node_id']} to {data['to_node_id']}")
    
print("\nVerifying health...")
h_resp = requests.get("http://localhost:5001/health")
print(h_resp.json())
