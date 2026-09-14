"""
Pathfinding over the admin-declared node/edge graph.

- Dijkstra with Haversine-computed edge weights (never manually typed).
- Floor-aware full-tour via greedy nearest-neighbor with floor zig-zag avoidance.
- Turn-by-turn instruction generation using geodetic bearings.
"""

import heapq
import math
from app.utils.geo import haversine_distance


# ---------------------------------------------------------------------------
# Dijkstra
# ---------------------------------------------------------------------------

def _build_graph(nodes_dict, edges_list):
    """Build a bidirectional adjacency list from walkable edges.
    Prefers explicit edge distance, then Haversine if GPS present, else Euclidean with scale."""
    graph = {nid: [] for nid in nodes_dict}
    for e in edges_list:
        if not e.get("walkable", True):
            continue
        u, v = e["from_node_id"], e["to_node_id"]
        if u not in graph or v not in graph:
            continue
        nu, nv = nodes_dict[u], nodes_dict[v]
        
        # Priority 1: Explicit stored edge distance
        edge_dist = e.get("distance")
        if edge_dist is not None and float(edge_dist) > 0:
            dist = float(edge_dist)
        # Priority 2: GPS coordinates if available on both nodes
        elif nu.get("latitude") is not None and nv.get("latitude") is not None:
            dist = haversine_distance(
                nu["latitude"], nu["longitude"],
                nv["latitude"], nv["longitude"],
            )
        # Priority 3: Euclidean distance using pixel coordinates and realistic scale
        else:
            x1 = float(nu.get("x_coordinate") or 0)
            x2 = float(nv.get("x_coordinate") or 0)
            y1 = float(nu.get("y_coordinate") or 0)
            y2 = float(nv.get("y_coordinate") or 0)
            dx = (x1 - x2) * 1000.0 if x1 <= 1.0 and x2 <= 1.0 else (x1 - x2)
            dy = (y1 - y2) * 1000.0 if y1 <= 1.0 and y2 <= 1.0 else (y1 - y2)
            # Default scale ~0.035 meters per pixel if not specified
            dist = max(0.5, math.hypot(dx, dy) * 0.035)
            
        edge_type = e.get("edge_type", "normal")
        graph[u].append((v, dist, edge_type))
        graph[v].append((u, dist, edge_type))
    return graph


def find_shortest_path(start_id, end_id, nodes_dict, edges_list):
    """
    Dijkstra shortest path.
    Returns (path_list_of_node_dicts, total_distance_m, instructions_list).
    Returns (None, 0, []) when no route exists.
    """
    graph = _build_graph(nodes_dict, edges_list)

    if start_id not in graph or end_id not in graph:
        return None, 0, []

    dist = {nid: float("inf") for nid in nodes_dict}
    dist[start_id] = 0.0
    prev = {}
    pq = [(0.0, start_id)]

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        if u == end_id:
            break
        for v, w, _ in graph.get(u, []):
            alt = d + w
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                heapq.heappush(pq, (alt, v))

    if dist[end_id] == float("inf"):
        return None, 0, []

    # Reconstruct path
    path = []
    cur = end_id
    while cur is not None:
        path.append(nodes_dict[cur])
        cur = prev.get(cur)
    path.reverse()

    instructions = generate_instructions(path)
    return path, dist[end_id], instructions


# ---------------------------------------------------------------------------
# Floor-aware full tour (greedy nearest-neighbor, zig-zag avoidance)
# ---------------------------------------------------------------------------

def is_exit_node(node):
    if not node or not node.get("node_type"):
        return False
    tags = [t.strip() for t in str(node["node_type"]).split(",")]
    return "exit" in tags


def plan_full_tour(start_id, exit_id, artifact_ids, nodes_dict, edges_list):
    """
    Greedy nearest-neighbor tour from start through all artifacts to exit.
    Floor-aware: prefers same-floor artifacts before switching floors.
    If exit_id is not specified or invalid, finds the optimal exit door node among all exits.
    """
    if not artifact_ids:
        if exit_id and exit_id in nodes_dict:
            return find_shortest_path(start_id, exit_id, nodes_dict, edges_list)
        else:
            exit_candidates = [nid for nid, n in nodes_dict.items() if is_exit_node(n)]
            best_p, best_d, best_i = None, float("inf"), []
            for eid in exit_candidates:
                p, d, i = find_shortest_path(start_id, eid, nodes_dict, edges_list)
                if p and d < best_d:
                    best_p, best_d, best_i = p, d, i
            return best_p, (best_d if best_p else 0), best_i

    full_path = []
    full_instructions = []
    total_dist = 0.0

    current = start_id
    remaining = list(artifact_ids)

    while remaining:
        current_floor = nodes_dict.get(current, {}).get("floor")

        # Partition into same-floor and cross-floor
        same_floor = [a for a in remaining if nodes_dict.get(a, {}).get("floor") == current_floor]
        candidates = same_floor if same_floor else remaining

        best_id = None
        best_route = None
        best_dist = float("inf")

        for aid in candidates:
            path, d, instr = find_shortest_path(current, aid, nodes_dict, edges_list)
            if path and d < best_dist:
                best_dist = d
                best_id = aid
                best_route = (path, d, instr)

        if best_route is None or best_id is None:
            # Can't reach any remaining artifact; skip them
            break

        path, d, instr = best_route
        if full_path and path:
            full_path.extend(path[1:])
        else:
            full_path.extend(path)
        full_instructions.extend(instr)
        total_dist += d

        current = best_id
        remaining.remove(best_id)

    # Route to exit
    exit_path, exit_d, exit_instr = None, 0, []
    if exit_id and exit_id in nodes_dict:
        exit_path, exit_d, exit_instr = find_shortest_path(current, exit_id, nodes_dict, edges_list)
    
    if not exit_path:
        # Evaluate all exit door nodes and pick the shortest route from current
        exit_candidates = [nid for nid, n in nodes_dict.items() if is_exit_node(n)]
        best_exit_dist = float("inf")
        for eid in exit_candidates:
            epath, edist, einstr = find_shortest_path(current, eid, nodes_dict, edges_list)
            if epath and edist < best_exit_dist:
                best_exit_dist = edist
                exit_path, exit_d, exit_instr = epath, edist, einstr

    if exit_path:
        if full_path:
            full_path.extend(exit_path[1:])
        else:
            full_path.extend(exit_path)
        full_instructions.extend(exit_instr)
        total_dist += exit_d

    return full_path, total_dist, full_instructions


# ---------------------------------------------------------------------------
# Instruction generation
# ---------------------------------------------------------------------------

def _bearing(lat1, lon1, lat2, lon2):
    """Initial bearing in degrees from (lat1,lon1) → (lat2,lon2)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _turn_word(angle_diff):
    """Human-readable turn direction from a signed angle difference."""
    d = ((angle_diff + 180) % 360) - 180
    if abs(d) < 25:
        return None  # Straight
    if d > 0:
        return "Turn right" if d < 100 else "Sharp right"
    return "Turn left" if d > -100 else "Sharp left"


def generate_instructions(path):
    """Generate turn-by-turn instructions from a path of node dicts."""
    if not path or len(path) < 2:
        return ["You have arrived."]

    instructions = [f"Start at {path[0].get('name', 'here')}"]

    def _get_dist(n1, n2):
        if n1.get("latitude") is not None and n2.get("latitude") is not None:
            return haversine_distance(n1["latitude"], n1["longitude"], n2["latitude"], n2["longitude"])
        x1 = float(n1.get("x_coordinate") or 0)
        x2 = float(n2.get("x_coordinate") or 0)
        y1 = float(n1.get("y_coordinate") or 0)
        y2 = float(n2.get("y_coordinate") or 0)
        dx_px = (x1 - x2) * 613 if x1 <= 1.0 and x2 <= 1.0 else (x1 - x2)
        dy_px = (y1 - y2) * 370 if y1 <= 1.0 and y2 <= 1.0 else (y1 - y2)
        return max(1.0, math.hypot(dx_px, dy_px) * 0.035)

    def _get_bearing(n1, n2):
        if n1.get("latitude") is not None and n2.get("latitude") is not None:
            return _bearing(n1["latitude"], n1["longitude"], n2["latitude"], n2["longitude"])
        x1 = float(n1.get("x_coordinate") or 0)
        x2 = float(n2.get("x_coordinate") or 0)
        y1 = float(n1.get("y_coordinate") or 0)
        y2 = float(n2.get("y_coordinate") or 0)
        dx = (x2 - x1) * 613 if x1 <= 1.0 and x2 <= 1.0 else (x2 - x1)
        dy = (y2 - y1) * 370 if y1 <= 1.0 and y2 <= 1.0 else (y2 - y1)
        return (math.degrees(math.atan2(dx, -dy)) + 360) % 360

    for i in range(len(path) - 1):
        cur = path[i]
        nxt = path[i + 1]

        # Floor change
        if cur.get("floor") != nxt.get("floor"):
            connector = nxt.get("node_type", "stairs")
            if connector not in ("stairs", "elevator", "escalator"):
                connector = "stairs/elevator"
            instructions.append(f"Take the {connector} to Floor {nxt.get('floor')}")
            continue

        if i == len(path) - 2:
            dist = _get_dist(cur, nxt)
            instructions.append(f"Arrive at {nxt.get('name', 'destination')} ({round(dist)} m ahead)")
            continue

        # Bearing turn detection
        nnxt = path[i + 2]
        if nxt.get("floor") != nnxt.get("floor"):
            dist = _get_dist(cur, nxt)
            instructions.append(f"Walk straight for {round(dist)} m")
            continue

        b1 = _get_bearing(cur, nxt)
        b2 = _get_bearing(nxt, nnxt)
        turn = _turn_word(b2 - b1)

        dist = _get_dist(cur, nxt)
        if turn:
            instructions.append(f"{turn} at {nxt.get('name', 'waypoint')} ({round(dist)} m)")
        else:
            instructions.append(f"Walk straight for {round(dist)} m")

    return instructions


# ---------------------------------------------------------------------------
# Nearby (Haversine-based, graph-agnostic)
# ---------------------------------------------------------------------------

def get_nearby_nodes(start_node_id, radius_meters=None, hops=None, nodes_dict=None, edges_list=None):
    """Return nodes within *hops* graph-hops of start_node_id."""
    if not nodes_dict or not edges_list or start_node_id not in nodes_dict:
        return []
    if hops is None:
        hops = 3

    graph = {n: [] for n in nodes_dict}
    for e in edges_list:
        if not e.get("walkable", True):
            continue
        u, v = str(e["from_node_id"]), str(e["to_node_id"])
        if u in graph and v in graph:
            graph[u].append(v)
            graph[v].append(u)

    visited = {start_node_id}
    queue = [(start_node_id, 0)]
    result = []
    while queue:
        curr, h = queue.pop(0)
        if curr != start_node_id:
            result.append(nodes_dict[curr])
        if h < hops:
            for nbr in graph.get(curr, []):
                if nbr not in visited:
                    visited.add(nbr)
                    queue.append((nbr, h + 1))
    return result
