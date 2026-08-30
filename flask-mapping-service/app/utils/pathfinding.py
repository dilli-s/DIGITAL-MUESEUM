import heapq
import math
from app.utils.geo import haversine_distance

def get_heuristic(node_a, node_b):
    """
    Straight-line Euclidean distance in normalized space as the A* heuristic.
    """
    dx = node_a.get('x_coordinate', 0) - node_b.get('x_coordinate', 0)
    dy = node_a.get('y_coordinate', 0) - node_b.get('y_coordinate', 0)
    return math.sqrt(dx*dx + dy*dy)

def a_star(start_node_id, dest_node_id, nodes_dict, edges_list):
    """
    A* pathfinding algorithm over the map nodes.
    nodes_dict: dict of node_id -> node_data
    edges_list: list of edge_data dicts
    Returns (path, distance_m, time_s)
    """
    # Build adjacency list
    graph = {n: [] for n in nodes_dict}
    for e in edges_list:
        if not e.get('walkable', True):
            continue
        u, v = e['from_node_id'], e['to_node_id']
        dist = e.get('distance', 0)
        if u in graph and v in graph:
            graph[u].append((v, dist))
            graph[v].append((u, dist)) # Undirected for museum corridors
            
    if start_node_id not in graph or dest_node_id not in graph:
        return None, 0, 0
        
    dest_node = nodes_dict[dest_node_id]
    
    # Priority queue: (f_score, node_id)
    pq = [(0, start_node_id)]
    
    # Cost from start to node
    g_score = {n: float('inf') for n in nodes_dict}
    g_score[start_node_id] = 0
    
    # Came from map to reconstruct path
    came_from = {}
    
    while pq:
        current_f, current = heapq.heappop(pq)
        
        if current == dest_node_id:
            break
            
        for neighbor, weight in graph[current]:
            tentative_g = g_score[current] + weight
            
            if tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                h = get_heuristic(nodes_dict[neighbor], dest_node)
                f = tentative_g + h # Note: mixing meters and normalized units isn't ideal but works as heuristic
                heapq.heappush(pq, (f, neighbor))
                
    if g_score[dest_node_id] == float('inf'):
        return None, 0, 0
        
    # Reconstruct path
    path = []
    curr = dest_node_id
    while curr in came_from:
        path.append(nodes_dict[curr])
        curr = came_from[curr]
    path.append(nodes_dict[start_node_id])
    path.reverse()
    
    distance = g_score[dest_node_id]
    time_s = distance / 1.2 # average walking speed ~1.2m/s
    
    return path, distance, time_s

def generate_instructions(path):
    """
    Generates turn-by-turn instructions based on bearing changes between segments.
    """
    if len(path) < 2:
        return ["You have arrived."]
        
    instructions = []
    
    for i in range(len(path) - 1):
        if i == len(path) - 2:
            instructions.append("Artifact is ahead.")
        else:
            # Simple bearing change logic (using normalized coords just for angles)
            curr = path[i]
            nxt = path[i+1]
            nnxt = path[i+2]
            
            dx1 = nxt.get('x_coordinate', 0) - curr.get('x_coordinate', 0)
            dy1 = nxt.get('y_coordinate', 0) - curr.get('y_coordinate', 0)
            
            dx2 = nnxt.get('x_coordinate', 0) - nxt.get('x_coordinate', 0)
            dy2 = nnxt.get('y_coordinate', 0) - nxt.get('y_coordinate', 0)
            
            theta1 = math.atan2(dy1, dx1)
            theta2 = math.atan2(dy2, dx2)
            
            diff = (theta2 - theta1) * 180 / math.pi
            # Normalize to -180 to 180
            diff = (diff + 180) % 360 - 180
            
            if abs(diff) < 30:
                instructions.append(f"Walk straight for {int(haversine_distance(curr.get('latitude',0), curr.get('longitude',0), nxt.get('latitude',0), nxt.get('longitude',0)))} meters.")
            elif diff > 0:
                instructions.append("Turn right.")
            else:
                instructions.append("Turn left.")
                
    return instructions

# Preserve existing Dijkstra for backward compatibility
def dijkstra(start_node_id, to_node_id, nodes, edges):
    res = a_star(start_node_id, to_node_id, nodes, edges)
    return res[0] if res else None

def find_shortest_path(start_node_id, to_node_id, nodes_dict, edges_list):
    path, distance, time_s = a_star(start_node_id, to_node_id, nodes_dict, edges_list)
    instructions = generate_instructions(path) if path else []
    return path, distance, instructions

def get_nearby_nodes(start_node_id, radius_meters=None, hops=None, nodes_dict=None, edges_list=None):
    if not nodes_dict or not edges_list or start_node_id not in nodes_dict:
        return []
    if hops is None: hops = 3
    graph = {n: [] for n in nodes_dict}
    for e in edges_list:
        if not e.get('walkable', True): continue
        u, v = str(e['from_node_id']), str(e['to_node_id'])
        if u in graph and v in graph:
            graph[u].append(v)
            graph[v].append(u)
    visited = {start_node_id}
    queue = [(start_node_id, 0)]
    result = []
    while queue:
        curr, h = queue.pop(0)
        if curr != start_node_id: result.append(nodes_dict[curr])
        if h < hops:
            for nbr in graph[curr]:
                if nbr not in visited:
                    visited.add(nbr)
                    queue.append((nbr, h + 1))
    return result
