import pytest
from app.utils.db import execute_query

@pytest.fixture
def sample_graph(client):
    # Create 4 nodes
    nodes = []
    for i in range(4):
        resp = client.post('/api/nodes', json={
            "name": f"Test Node {i}",
            "floor": 1,
            "x_coordinate": float(i * 10),
            "y_coordinate": float(i * 10),
            "node_type": "junction" if i != 0 and i != 3 else "waypoint"
        })
        assert resp.status_code == 201
        nodes.append(resp.get_json()['data'])
        
    # Create edges: 0-1, 1-2, 2-3
    edges = [
        {"from_node_id": nodes[0]['id'], "to_node_id": nodes[1]['id'], "distance": 10.0, "walkable": True},
        {"from_node_id": nodes[1]['id'], "to_node_id": nodes[2]['id'], "distance": 10.0, "walkable": True},
        {"from_node_id": nodes[2]['id'], "to_node_id": nodes[3]['id'], "distance": 10.0, "walkable": True},
    ]
    
    for edge in edges:
        resp = client.post('/api/edges', json=edge)
        assert resp.status_code == 201
        
    yield nodes
    
    # Teardown: delete the created nodes (cascade will delete edges)
    for node in nodes:
        execute_query("DELETE FROM map_nodes WHERE id = %s", (node['id'],), commit=True)

def test_get_shortest_path(client, sample_graph):
    nodes = sample_graph
    
    # Shortest path from 0 to 3 should be 0 -> 1 -> 2 -> 3
    resp = client.get(f"/api/route?from={nodes[0]['id']}&to={nodes[3]['id']}")
    assert resp.status_code == 200
    
    data = resp.get_json()
    assert data['distance'] > 0
    
    path = data['path']
    assert len(path) == 4
    assert path[0]['id'] == nodes[0]['id']
    assert path[1]['id'] == nodes[1]['id']
    assert path[2]['id'] == nodes[2]['id']
    assert path[3]['id'] == nodes[3]['id']
