"""
Building Footprint model and validation logic per floor plan.
"""
import logging
import math
from app.utils.db import execute_query
from app.models.floor_plan import get_floor_plan_by_id
from app.utils.geo import map_xy_to_gps
from app.utils.geometry import point_in_polygon

def sort_points_by_polar_angle(points):
    if not points or len(points) < 3:
        return points

    sum_x = 0.0
    sum_y = 0.0
    for pt in points:
        x = float(pt.get('x', pt.get('longitude', pt.get('lng', 0.0))))
        y = float(pt.get('y', pt.get('latitude', pt.get('lat', 0.0))))
        sum_x += x
        sum_y += y

    cx = sum_x / len(points)
    cy = sum_y / len(points)

    def get_angle(pt):
        x = float(pt.get('x', pt.get('longitude', pt.get('lng', 0.0))))
        y = float(pt.get('y', pt.get('latitude', pt.get('lat', 0.0))))
        return math.atan2(y - cy, x - cx)

    return sorted(points, key=get_angle)

def get_footprint_by_floor_plan(floor_plan_id):
    query = """
        SELECT id, corner_order, x, y, latitude, longitude, created_at
        FROM floor_plan_footprints
        WHERE floor_plan_id = %s::uuid
        ORDER BY corner_order ASC
    """
    rows = execute_query(query, (floor_plan_id,), fetch=True)
    if not rows:
        return {"floor_plan_id": str(floor_plan_id), "points": []}

    points = [
        {
            "id": str(r[0]),
            "corner_order": r[1],
            "x": r[2],
            "y": r[3],
            "latitude": r[4],
            "longitude": r[5],
            "created_at": r[6].isoformat() if r[6] else None
        }
        for r in rows
    ]
    return {"floor_plan_id": str(floor_plan_id), "points": sort_points_by_polar_angle(points)}

def save_footprint(floor_plan_id, points):
    plan = get_floor_plan_by_id(floor_plan_id)
    if not plan:
        return None

    # Delete existing footprint rows
    execute_query("DELETE FROM floor_plan_footprints WHERE floor_plan_id = %s::uuid", (floor_plan_id,), commit=True)

    if points:
        sorted_points = sort_points_by_polar_angle(points)
        for idx, pt in enumerate(sorted_points):
            x = float(pt.get('x', pt.get('lng', 0)))
            y = float(pt.get('y', pt.get('lat', 0)))
            lat = pt.get('lat', pt.get('latitude'))
            lng = pt.get('lng', pt.get('longitude'))

            if lat is None or lng is None:
                if plan:
                    derived_lat, derived_lng = map_xy_to_gps(x, y, plan)
                    lat = derived_lat
                    lng = derived_lng

            query = """
                INSERT INTO floor_plan_footprints (floor_plan_id, corner_order, x, y, latitude, longitude)
                VALUES (%s::uuid, %s, %s, %s, %s, %s)
            """
            execute_query(query, (floor_plan_id, idx, x, y, lat, lng), commit=True)

    return get_footprint_by_floor_plan(floor_plan_id)

def validate_point_in_footprint(floor_plan_id, x, y):
    """
    Validates if (x, y) falls inside the building footprint for floor_plan_id.
    Returns (is_valid, error_message).
    If no footprint exists (< 3 points), validation is skipped and returns (True, None).
    """
    if not floor_plan_id or x is None or y is None:
        return True, None

    footprint = get_footprint_by_floor_plan(floor_plan_id)
    pts = footprint.get("points", []) if footprint else []

    if len(pts) < 3:
        # Soft fallback: footprint not yet defined, skip check
        return True, None

    sorted_pts = sort_points_by_polar_angle(pts)
    poly = [{"x": p["x"], "y": p["y"]} for p in sorted_pts]
    is_inside = point_in_polygon(float(x), float(y), poly)

    if not is_inside:
        return False, "Node position is outside the museum building boundary — check placement or footprint accuracy."

    return True, None
