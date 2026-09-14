"""
Geometry utility for room boundary and wall-crossing validation.
Uses ray-casting for point-in-polygon and line segment intersections with doorway tolerances.
"""
import math

def point_in_polygon(px, py, poly):
    """
    Standard Ray-Casting algorithm to check if point (px, py) is inside polygon.
    poly: list of (x, y) tuples or dicts with 'x' and 'y'
    """
    if not poly or len(poly) < 3:
        return False
    
    pts = [(p['x'], p['y']) if isinstance(p, dict) else p for p in poly]
    n = len(pts)
    inside = False
    
    p1x, p1y = pts[0]
    for i in range(n + 1):
        p2x, p2y = pts[i % n]
        if py > min(p1y, p2y):
            if py <= max(p1y, p2y):
                if px <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (py - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    else:
                        xinters = p1x
                    if p1x == p2x or px <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y

    return inside

def distance_point_to_segment(px, py, x1, y1, x2, y2):
    """
    Computes shortest distance from point (px, py) to line segment (x1, y1)-(x2, y2).
    """
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    return math.hypot(px - closest_x, py - closest_y)

def segment_intersection(p1, p2, p3, p4, eps=1e-5):
    """
    Returns intersection point (ix, iy) of line segment p1-p2 and p3-p4,
    or None if they do not intersect.
    """
    x1, y1 = p1
    x2, y2 = p2
    x3, y3 = p3
    x4, y4 = p4

    denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
    if abs(denom) < 1e-12:
        return None  # Parallel or colinear

    ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
    ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

    # Strictly inside segment bounds (or slightly within eps)
    if eps <= ua <= 1.0 - eps and eps <= ub <= 1.0 - eps:
        ix = x1 + ua * (x2 - x1)
        iy = y1 + ua * (y2 - y1)
        return (ix, iy)

    return None

def line_intersects_polygon_edge(x1, y1, x2, y2, poly):
    """
    Checks if line segment (x1, y1)-(x2, y2) crosses any edge of polygon.
    """
    pts = [(p['x'], p['y']) if isinstance(p, dict) else p for p in poly]
    n = len(pts)
    if n < 3:
        return False

    for i in range(n):
        b1 = pts[i]
        b2 = pts[(i + 1) % n]
        if segment_intersection((x1, y1), (x2, y2), b1, b2) is not None:
            return True
    return False

def segment_crosses_any_wall(x1, y1, x2, y2, all_rooms, doorways_data, door_tolerance=0.05):
    """
    Validates if edge segment (x1, y1) -> (x2, y2) crosses any room wall.
    Returns True if edge illegally crosses a wall or enters a non-walkable room.
    Returns False if path is clear or properly passes through a marked doorway.
    """
    mid_x = (x1 + x2) / 2.0
    mid_y = (y1 + y2) / 2.0

    for room in all_rooms:
        boundaries = room.get('boundaries', [])
        if not boundaries or len(boundaries) < 3:
            continue

        poly = [(b['x'], b['y']) if isinstance(b, dict) else b for b in boundaries]
        walkable = room.get('walkable', True)

        # 1. Non-walkable room check
        if not walkable:
            if point_in_polygon(x1, y1, poly) or point_in_polygon(x2, y2, poly) or point_in_polygon(mid_x, mid_y, poly):
                return True

        # 2. Boundary edge intersection check
        n = len(poly)
        for i in range(n):
            b1 = poly[i]
            b2 = poly[(i + 1) % n]

            pt = segment_intersection((x1, y1), (x2, y2), b1, b2)
            if pt is not None:
                ix, iy = pt

                # Check if intersection point ix, iy passes through a marked doorway opening
                is_doorway = False
                for d in doorways_data:
                    dist = distance_point_to_segment(ix, iy, d['x1'], d['y1'], d['x2'], d['y2'])
                    if dist <= door_tolerance:
                        is_doorway = True
                        break

                if not is_doorway:
                    return True

    return False
