"""
Room-Level Open-Path TSP Routing Engine.

Solves the optimal visiting sequence for all must-visit exhibit/artifact nodes inside a room:
entrance -> [ordered must-visit nodes] -> exit.

- Uses existing A* / Dijkstra pathfinding (find_shortest_path) for all pairwise segments.
- For <= 15 must-visit nodes: exact Held-Karp dynamic programming for open-path TSP.
- For > 15 must-visit nodes: greedy nearest-neighbor with 2-opt iterative refinement.
- In-memory route caching keyed by room_id with explicit invalidation hook.
"""
import time
import logging
from app.utils.pathfinding import find_shortest_path, generate_instructions
from app.utils.geometry import point_in_polygon
from app.models.map_node import get_all_nodes
from app.models.map_edge import get_all_edges
from app.models.room import get_rooms_by_floor_plan
from app.models.floor_plan import get_floor_plan_by_id
from app.models.artifact import get_artifacts
from app.utils.geo import map_xy_to_gps, gps_to_map_xy
from app.utils.db import execute_query

# In-memory route cache keyed by str(room_id)
_ROOM_ROUTE_CACHE = {}


def get_cached_room_route(room_id):
    """Retrieve cached route dictionary for room_id or None."""
    return _ROOM_ROUTE_CACHE.get(str(room_id))


def set_cached_room_route(room_id, data):
    """Store route dictionary in cache for room_id."""
    _ROOM_ROUTE_CACHE[str(room_id)] = data


def invalidate_room_route_cache(room_id=None):
    """Invalidate cache for specific room_id, or all rooms if room_id is None."""
    global _ROOM_ROUTE_CACHE
    if room_id is not None:
        popped = _ROOM_ROUTE_CACHE.pop(str(room_id), None)
        if popped:
            logging.info(f"[RoomRoutingCache] Invalidated cache for room {room_id}")
    else:
        _ROOM_ROUTE_CACHE.clear()
        logging.info("[RoomRoutingCache] Cleared all room route caches")


def _enrich_path_nodes(path, floor_plan=None, room_name=None, artifacts_dict=None):
    """
    Enrich raw node dictionaries with strictly normalized coordinates (0.0..1.0),
    affine-calibrated geodetic coordinates, location labels, and linked artifact data.
    """
    enriched = []
    for n in path:
        node_copy = dict(n)
        x_coord = node_copy.get("x_coordinate")
        y_coord = node_copy.get("y_coordinate")
        lat = node_copy.get("latitude")
        lng = node_copy.get("longitude")

        w = floor_plan.get("width_px") if floor_plan else None
        h = floor_plan.get("height_px") if floor_plan else None

        if x_coord is not None and y_coord is not None:
            if float(x_coord) > 1.0 and w:
                map_x = float(x_coord) / float(w)
            else:
                map_x = float(x_coord)
            if float(y_coord) > 1.0 and h:
                map_y = float(y_coord) / float(h)
            else:
                map_y = float(y_coord)
        elif lat is not None and lng is not None and floor_plan:
            map_x, map_y = gps_to_map_xy(lat, lng, floor_plan)
        else:
            map_x, map_y = 0.5, 0.5

        map_x = max(0.0, min(1.0, float(map_x)))
        map_y = max(0.0, min(1.0, float(map_y)))

        if floor_plan:
            calc_lat, calc_lng = map_xy_to_gps(map_x, map_y, floor_plan)
            if calc_lat is not None and calc_lng is not None:
                lat = calc_lat
                lng = calc_lng

        node_copy["map_x"] = round(map_x, 6)
        node_copy["map_y"] = round(map_y, 6)
        node_copy["latitude"] = lat
        node_copy["longitude"] = lng

        # Location label
        fp_name = floor_plan.get("name") if floor_plan else f"Floor {node_copy.get('floor', 1)}"
        r_label = room_name or fp_name
        node_copy["location_label"] = f"{node_copy.get('name', 'Waypoint')} · {r_label}"

        # Attach linked artifact record if artifact_id is present
        art_id = node_copy.get("artifact_id")
        if art_id and artifacts_dict and str(art_id) in artifacts_dict:
            node_copy["artifact"] = artifacts_dict[str(art_id)]

        enriched.append(node_copy)
    return enriched


def get_room_details(room_id):
    """Fetch room metadata and boundary points from database."""
    query = """
        SELECT id, floor_plan_id, name, room_type, walkable, created_at
        FROM rooms
        WHERE id = %s::uuid
    """
    row = execute_query(query, (str(room_id),), fetchone=True)
    if not row:
        return None

    b_query = """
        SELECT corner_order, x, y
        FROM room_boundaries
        WHERE room_id = %s::uuid
        ORDER BY corner_order ASC
    """
    b_rows = execute_query(b_query, (str(room_id),), fetch=True)
    boundaries = [{"x": float(r[1]), "y": float(r[2])} for r in (b_rows or [])]

    return {
        "id": str(row[0]),
        "floor_plan_id": str(row[1]),
        "name": row[2],
        "room_type": row[3],
        "walkable": bool(row[4]),
        "boundaries": boundaries
    }


def get_nodes_in_room(room):
    """
    Returns all nodes located on room's floor plan that fall inside room polygon boundaries.
    If room has no boundary polygon, returns all nodes on the floor plan.
    """
    floor_plan_id = room.get("floor_plan_id")
    all_floor_nodes = get_all_nodes(floor_plan_id=floor_plan_id)
    boundaries = room.get("boundaries")

    if not boundaries or len(boundaries) < 3:
        return all_floor_nodes

    room_nodes = []
    for node in all_floor_nodes:
        x = node.get("x_coordinate")
        y = node.get("y_coordinate")
        if x is not None and y is not None:
            if point_in_polygon(float(x), float(y), boundaries):
                room_nodes.append(node)

    return room_nodes


def solve_open_tsp_held_karp(start_id, end_id, must_visit_ids, dist_matrix):
    """
    Exact Held-Karp dynamic programming for open-path TSP with fixed start and end nodes.
    Optimal for k <= 15 must-visit nodes.
    Returns: (ordered_must_visit_ids, min_total_distance)
    """
    k = len(must_visit_ids)
    if k == 0:
        return [], dist_matrix.get((start_id, end_id), 0.0)

    if k == 1:
        single_id = must_visit_ids[0]
        total = dist_matrix.get((start_id, single_id), float('inf')) + dist_matrix.get((single_id, end_id), float('inf'))
        return [single_id], total

    # dp[(mask, i)] = (min_cost_to_reach_i, prev_node_index)
    dp: dict[tuple[int, int], tuple[float, int | None]] = {}

    # Base cases: start_id -> must_visit[i]
    for i in range(k):
        d = dist_matrix.get((start_id, must_visit_ids[i]), float('inf'))
        dp[(1 << i, i)] = (d, None)

    # DP over subset sizes from 2 to k
    for size in range(2, k + 1):
        # Generate masks with exactly 'size' bits set
        for mask in range(1, 1 << k):
            if bin(mask).count('1') != size:
                continue

            for i in range(k):
                if not (mask & (1 << i)):
                    continue

                prev_mask = mask ^ (1 << i)
                best_cost = float('inf')
                best_prev = None

                for j in range(k):
                    if j == i or not (prev_mask & (1 << j)):
                        continue

                    prev_cost, _ = dp.get((prev_mask, j), (float('inf'), None))
                    if prev_cost == float('inf'):
                        continue

                    leg_cost = dist_matrix.get((must_visit_ids[j], must_visit_ids[i]), float('inf'))
                    total = prev_cost + leg_cost
                    if total < best_cost:
                        best_cost = total
                        best_prev = j

                if best_cost < float('inf'):
                    dp[(mask, i)] = (best_cost, best_prev)

    # Final transition: must_visit[i] -> end_id
    full_mask = (1 << k) - 1
    best_total = float('inf')
    last_idx = None

    for i in range(k):
        cost_so_far, _ = dp.get((full_mask, i), (float('inf'), None))
        if cost_so_far == float('inf'):
            continue
        final_leg = dist_matrix.get((must_visit_ids[i], end_id), float('inf'))
        total = cost_so_far + final_leg
        if total < best_total:
            best_total = total
            last_idx = i

    if last_idx is None:
        # Fallback to natural order if graph disconnected
        return list(must_visit_ids), float('inf')

    # Backtrack to reconstruct the optimal order
    order = []
    curr_mask = full_mask
    curr_idx = last_idx
    while curr_idx is not None:
        order.append(curr_idx)
        _, prev_idx = dp.get((curr_mask, curr_idx), (0, None))
        curr_mask = curr_mask ^ (1 << curr_idx)
        curr_idx = prev_idx

    order.reverse()
    ordered_ids = [must_visit_ids[i] for i in order]
    return ordered_ids, best_total


def solve_open_tsp_2opt(start_id, end_id, must_visit_ids, dist_matrix):
    """
    Greedy Nearest-Neighbor construction followed by 2-Opt iterative refinement
    for open-path TSP with fixed start and end. Used for k > 15 must-visit nodes.
    Returns: (ordered_must_visit_ids, approximate_total_distance)
    """
    k = len(must_visit_ids)
    if k == 0:
        return [], dist_matrix.get((start_id, end_id), 0.0)

    # 1. Nearest Neighbor construction
    remaining = set(must_visit_ids)
    current = start_id
    tour = []

    while remaining:
        next_id = min(remaining, key=lambda nid: dist_matrix.get((current, nid), float('inf')))
        tour.append(next_id)
        remaining.remove(next_id)
        current = next_id

    # 2. 2-opt refinement on intermediate tour with fixed endpoints start_id & end_id
    improved = True
    passes = 0
    max_passes = 60

    while improved and passes < max_passes:
        improved = False
        passes += 1
        for i in range(len(tour) - 1):
            for j in range(i + 1, len(tour)):
                prev_node = start_id if i == 0 else tour[i - 1]
                next_node = end_id if j == len(tour) - 1 else tour[j + 1]

                current_leg1 = dist_matrix.get((prev_node, tour[i]), float('inf'))
                current_leg2 = dist_matrix.get((tour[j], next_node), float('inf'))
                new_leg1 = dist_matrix.get((prev_node, tour[j]), float('inf'))
                new_leg2 = dist_matrix.get((tour[i], next_node), float('inf'))

                if (new_leg1 + new_leg2) < (current_leg1 + current_leg2) - 1e-6:
                    tour[i:j + 1] = reversed(tour[i:j + 1])
                    improved = True
                    break
            if improved:
                break

    # Calculate total distance
    total_dist = dist_matrix.get((start_id, tour[0]), 0.0)
    for idx in range(len(tour) - 1):
        total_dist += dist_matrix.get((tour[idx], tour[idx + 1]), 0.0)
    total_dist += dist_matrix.get((tour[-1], end_id), 0.0)

    return tour, total_dist


def calculate_full_room_route(room_id, force_refresh=False, explicit_must_visit_ids=None):
    """
    Core function to calculate the full open-path TSP route through a room:
    entrance -> all must-visit nodes (in optimal sequence) -> exit.
    """
    str_room_id = str(room_id)

    # 1. Return cached result if available and not forcing refresh
    if not force_refresh and explicit_must_visit_ids is None:
        cached = get_cached_room_route(str_room_id)
        if cached:
            cached_copy = dict(cached)
            cached_copy["cached"] = True
            return cached_copy, None

    start_time = time.perf_counter()

    # 2. Fetch room details
    room = get_room_details(str_room_id)
    if not room:
        return None, "Room not found"

    # 3. Fetch nodes located inside this room
    room_nodes = get_nodes_in_room(room)
    if not room_nodes:
        return None, "No nodes mapped in this room"

    room_nodes_dict = {str(n["id"]): n for n in room_nodes}

    # Fetch floor plan and artifacts for coordinate calibration and metadata enrichment
    floor_plan_id = room.get("floor_plan_id")
    floor_plan = get_floor_plan_by_id(floor_plan_id) if floor_plan_id else None
    artifacts = get_artifacts(floor_plan_id) if floor_plan_id else []
    artifacts_dict = {str(a["id"]): a for a in (artifacts or [])}

    # Identify Entrance and Exit nodes
    entrance_node = None
    exit_node = None

    for n in room_nodes:
        tags = [t.strip().lower() for t in str(n.get("node_type") or "").split(",")]
        if "entrance" in tags and entrance_node is None:
            entrance_node = n
        if "exit" in tags and exit_node is None:
            exit_node = n

    # Fallback if no explicit exit tag is found: use entrance as exit (single door)
    if entrance_node is not None and exit_node is None:
        exit_node = entrance_node
    elif exit_node is not None and entrance_node is None:
        entrance_node = exit_node

    if not entrance_node:
        entrance_node = room_nodes[0]
    if not exit_node:
        exit_node = entrance_node

    # Identify must-visit nodes (automatically include all artifact-linked exhibit stops)
    must_visit_nodes = []
    if explicit_must_visit_ids is not None:
        for nid in explicit_must_visit_ids:
            str_nid = str(nid)
            if str_nid in room_nodes_dict:
                node = room_nodes_dict[str_nid]
                if node["id"] != entrance_node["id"] and node["id"] != exit_node["id"]:
                    must_visit_nodes.append(node)
    else:
        for node in room_nodes:
            is_artifact_stop = (
                node.get("artifact_id") is not None
                or node.get("node_type") in ("exhibit", "artifact")
                or node.get("is_must_visit") is True
            )
            if is_artifact_stop:
                if node["id"] != entrance_node["id"] and node["id"] != exit_node["id"]:
                    must_visit_nodes.append(node)

    # 4. Fetch global graph components needed for A* shortest path
    all_nodes = get_all_nodes()
    global_nodes_dict = {str(n["id"]): n for n in all_nodes}
    all_edges = get_all_edges()

    must_visit_ids = [str(n["id"]) for n in must_visit_nodes]
    entrance_id = str(entrance_node["id"])
    exit_id = str(exit_node["id"])

    # If no must-visit nodes: direct entrance -> exit routing
    if not must_visit_ids:
        if entrance_id == exit_id:
            direct_path = [entrance_node]
            direct_dist = 0.0
            direct_instr = [f"Start at {entrance_node.get('name', 'entrance')}"]
        else:
            direct_path, direct_dist, direct_instr = find_shortest_path(
                entrance_id, exit_id, global_nodes_dict, all_edges
            )
            if not direct_path:
                direct_path = [entrance_node, exit_node]
                direct_dist = 0.0
                direct_instr = []

        enriched_direct_path = _enrich_path_nodes(direct_path, floor_plan, room.get("name"), artifacts_dict)
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        result = {
            "success": True,
            "room_id": str_room_id,
            "room_name": room.get("name"),
            "entrance_id": entrance_id,
            "exit_id": exit_id,
            "must_visit_count": 0,
            "must_visit_order": [],
            "path": enriched_direct_path,
            "route": enriched_direct_path,
            "distance": round(float(direct_dist), 2),
            "distance_m": round(float(direct_dist), 2),
            "instructions": direct_instr,
            "cached": False,
            "solver": "direct",
            "execution_time_ms": round(elapsed_ms, 2)
        }
        if floor_plan:
            result["floor_plan"] = {
                "id": str(floor_plan["id"]),
                "name": floor_plan.get("name"),
                "width_px": floor_plan.get("width_px"),
                "height_px": floor_plan.get("height_px"),
                "affine_transform": floor_plan.get("affine_transform"),
                "scale_meters_per_px": floor_plan.get("scale_meters_per_px")
            }
        if explicit_must_visit_ids is None:
            set_cached_room_route(str_room_id, result)
        return result, None

    # 5. Build pairwise distance and path matrix among {entrance, exit, all must-visit}
    key_node_ids = list(dict.fromkeys([entrance_id] + must_visit_ids + [exit_id]))
    dist_matrix = {}
    pairwise_paths = {}

    for i in range(len(key_node_ids)):
        for j in range(len(key_node_ids)):
            u = key_node_ids[i]
            v = key_node_ids[j]
            if u == v:
                dist_matrix[(u, v)] = 0.0
                pairwise_paths[(u, v)] = [global_nodes_dict[u]]
            else:
                path, dist, _ = find_shortest_path(u, v, global_nodes_dict, all_edges)
                if path is not None:
                    dist_matrix[(u, v)] = float(dist)
                    pairwise_paths[(u, v)] = path
                else:
                    dist_matrix[(u, v)] = float('inf')
                    pairwise_paths[(u, v)] = []

    # 6. Solve Open-Path TSP
    if len(must_visit_ids) <= 15:
        solver_name = "held-karp"
        ordered_must_visit_ids, _ = solve_open_tsp_held_karp(
            entrance_id, exit_id, must_visit_ids, dist_matrix
        )
    else:
        solver_name = "nearest-neighbor-2opt"
        ordered_must_visit_ids, _ = solve_open_tsp_2opt(
            entrance_id, exit_id, must_visit_ids, dist_matrix
        )

    # 7. Stitch individual A* segments together in solved order into one continuous path
    target_sequence = [entrance_id] + ordered_must_visit_ids + [exit_id]
    full_path = []
    total_distance = 0.0

    for s in range(len(target_sequence) - 1):
        u = target_sequence[s]
        v = target_sequence[s + 1]
        if u == v:
            continue

        seg = pairwise_paths.get((u, v))
        if not seg:
            # Fallback if pairwise lookup missed
            seg, seg_dist, _ = find_shortest_path(u, v, global_nodes_dict, all_edges)
            if seg:
                pairwise_paths[(u, v)] = seg
                pairwise_dist = seg_dist
            else:
                seg = [global_nodes_dict[u], global_nodes_dict[v]]
                pairwise_dist = 0.0
        else:
            pairwise_dist = dist_matrix.get((u, v), 0.0)

        total_distance += pairwise_dist

        if not full_path:
            full_path.extend(seg)
        else:
            # Avoid duplicate node at boundary
            full_path.extend(seg[1:])

    # 8. Generate turn-by-turn instructions for full stitched path
    instructions = generate_instructions(full_path)
    enriched_full_path = _enrich_path_nodes(full_path, floor_plan, room.get("name"), artifacts_dict)

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    result = {
        "success": True,
        "room_id": str_room_id,
        "room_name": room.get("name"),
        "entrance_id": entrance_id,
        "exit_id": exit_id,
        "must_visit_count": len(ordered_must_visit_ids),
        "must_visit_order": ordered_must_visit_ids,
        "path": enriched_full_path,
        "route": enriched_full_path,
        "distance": round(float(total_distance), 2),
        "distance_m": round(float(total_distance), 2),
        "instructions": instructions,
        "cached": False,
        "solver": solver_name,
        "execution_time_ms": round(elapsed_ms, 2)
    }

    if floor_plan:
        result["floor_plan"] = {
            "id": str(floor_plan["id"]),
            "name": floor_plan.get("name"),
            "width_px": floor_plan.get("width_px"),
            "height_px": floor_plan.get("height_px"),
            "affine_transform": floor_plan.get("affine_transform"),
            "scale_meters_per_px": floor_plan.get("scale_meters_per_px")
        }

    if explicit_must_visit_ids is None:
        set_cached_room_route(str_room_id, result)

    return result, None
