"""
Geodetic utility functions — single source of truth for all distance calculations.

All museum navigation distances trace back to haversine_distance() defined here.
Rounding: ≥10m → nearest meter; <10m → 0.1m precision. Full precision stored underneath.
"""

import math


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Returns the great-circle distance in **meters** between two
    (latitude, longitude) points on Earth using the Haversine formula.
    """
    R = 6_371_000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def format_distance(meters):
    """
    Display-friendly distance string.
    <10m  → '3.2 m'
    ≥10m → '42 m'
    """
    if meters < 10:
        return f"{meters:.1f} m"
    return f"{round(meters)} m"


def pixel_to_latlng(x_px, y_px, floor_plan):
    """Backward-compatibility stub — calls map_xy_to_gps."""
    return map_xy_to_gps(x_px, y_px, floor_plan)


def latlng_to_pixel(lat, lng, floor_plan):
    """Backward-compatibility stub — converts lat/lng to pixel coordinates."""
    if not floor_plan or lat is None or lng is None:
        return None, None
    w = float(floor_plan.get("width_px") or 1000)
    h = float(floor_plan.get("height_px") or 1000)
    norm_x, norm_y = gps_to_map_xy(lat, lng, floor_plan)
    if norm_x is None or norm_y is None:
        return None, None
    return norm_x * w, norm_y * h


def map_xy_to_gps(map_x, map_y, floor_plan):
    """
    Convert normalized map coordinates (0..1) or pixel coordinates on floor plan to (lat, lng).
    Prioritizes affine_transform if available, then falls back to anchor points.
    """
    if not floor_plan:
        return None, None

    w = float(floor_plan.get("width_px") or 1000)
    h = float(floor_plan.get("height_px") or 1000)

    norm_x = float(map_x) if (map_x is not None and map_x <= 1.0) else (float(map_x or 0.0) / w if w > 0 else 0.0)
    norm_y = float(map_y) if (map_y is not None and map_y <= 1.0) else (float(map_y or 0.0) / h if h > 0 else 0.0)

    # 1. Check affine_transform first
    affine = floor_plan.get("affine_transform")
    if isinstance(affine, str):
        import json
        try:
            affine = json.loads(affine)
        except Exception:
            affine = None

    if affine and isinstance(affine, dict):
        if affine.get("type") == "affine" and all(k in affine for k in ['a', 'b', 'c', 'd', 'e', 'f']):
            lng = float(affine['a']) * norm_x + float(affine['b']) * norm_y + float(affine['c'])
            lat = float(affine['d']) * norm_x + float(affine['e']) * norm_y + float(affine['f'])
            return lat, lng
        elif affine.get("type") == "similarity" and all(k in affine for k in ['scale_x', 'scale_y', 'offset_x', 'offset_y']):
            lng = float(affine['scale_x']) * norm_x + float(affine['offset_x'])
            lat = float(affine['scale_y']) * norm_y + float(affine['offset_y'])
            return lat, lng

    # 2. Fallback to anchor_1 and anchor_2
    px = map_x * w if (map_x is not None and map_x <= 1.0) else (map_x or 0.0)
    py = map_y * h if (map_y is not None and map_y <= 1.0) else (map_y or 0.0)

    a1_x = floor_plan.get("anchor_1_x_px")
    a1_y = floor_plan.get("anchor_1_y_px")
    a1_lat = floor_plan.get("anchor_1_lat")
    a1_lng = floor_plan.get("anchor_1_lng")

    a2_x = floor_plan.get("anchor_2_x_px")
    a2_y = floor_plan.get("anchor_2_y_px")
    a2_lat = floor_plan.get("anchor_2_lat")
    a2_lng = floor_plan.get("anchor_2_lng")

    if (a1_x is not None and a1_y is not None and a1_lat is not None and a1_lng is not None and
            a2_x is not None and a2_y is not None and a2_lat is not None and a2_lng is not None):
        dx_px = a2_x - a1_x
        dy_px = a2_y - a1_y
        dlat = a2_lat - a1_lat
        dlng = a2_lng - a1_lng

        rx = (px - a1_x) / dx_px if dx_px != 0 else 0.0
        ry = (py - a1_y) / dy_px if dy_px != 0 else 0.0

        lat = a1_lat + ry * dlat
        lng = a1_lng + rx * dlng
        return lat, lng

    return None, None


def gps_to_map_xy(lat, lng, floor_plan):
    """
    Convert (lat, lng) to normalized map coordinates (0..1 map_x, map_y).
    Prioritizes affine_transform if available, then falls back to anchor points.
    """
    if not floor_plan or lat is None or lng is None:
        return 0.5, 0.5

    # 1. Check affine_transform first
    affine = floor_plan.get("affine_transform")
    if isinstance(affine, str):
        import json
        try:
            affine = json.loads(affine)
        except Exception:
            affine = None

    if affine and isinstance(affine, dict):
        if affine.get("type") == "affine" and all(k in affine for k in ['a', 'b', 'c', 'd', 'e', 'f']):
            a = float(affine['a'])
            b = float(affine['b'])
            c = float(affine['c'])
            d = float(affine['d'])
            e = float(affine['e'])
            f = float(affine['f'])
            det = a * e - b * d
            if abs(det) > 1e-12:
                norm_x = (e * (float(lng) - c) - b * (float(lat) - f)) / det
                norm_y = (-d * (float(lng) - c) + a * (float(lat) - f)) / det
                return max(0.0, min(1.0, norm_x)), max(0.0, min(1.0, norm_y))
        elif affine.get("type") == "similarity" and all(k in affine for k in ['scale_x', 'scale_y', 'offset_x', 'offset_y']):
            sx = float(affine['scale_x'])
            sy = float(affine['scale_y'])
            ox = float(affine['offset_x'])
            oy = float(affine['offset_y'])
            norm_x = (float(lng) - ox) / sx if sx != 0 else 0.5
            norm_y = (float(lat) - oy) / sy if sy != 0 else 0.5
            return max(0.0, min(1.0, norm_x)), max(0.0, min(1.0, norm_y))

    # 2. Fallback to anchor_1 and anchor_2
    w = float(floor_plan.get("width_px") or 1000)
    h = float(floor_plan.get("height_px") or 1000)

    a1_x = floor_plan.get("anchor_1_x_px")
    a1_y = floor_plan.get("anchor_1_y_px")
    a1_lat = floor_plan.get("anchor_1_lat")
    a1_lng = floor_plan.get("anchor_1_lng")

    a2_x = floor_plan.get("anchor_2_x_px")
    a2_y = floor_plan.get("anchor_2_y_px")
    a2_lat = floor_plan.get("anchor_2_lat")
    a2_lng = floor_plan.get("anchor_2_lng")

    if (a1_x is not None and a1_y is not None and a1_lat is not None and a1_lng is not None and
            a2_x is not None and a2_y is not None and a2_lat is not None and a2_lng is not None):
        dlat = a2_lat - a1_lat
        dlng = a2_lng - a1_lng
        dx_px = a2_x - a1_x
        dy_px = a2_y - a1_y

        ry = (lat - a1_lat) / dlat if dlat != 0 else 0.0
        rx = (lng - a1_lng) / dlng if dlng != 0 else 0.0

        px = a1_x + rx * dx_px
        py = a1_y + ry * dy_px

        return px / w, py / h

    return 0.5, 0.5


import numpy as np

def affine_transform_from_anchors(anchors):
    """
    Solve 6 affine params from 2+ anchor correspondences using least-squares.
    Handles 2-point similarity transform as fallback.
    anchors is a list of dicts: {'map_x':, 'map_y':, 'latitude':, 'longitude':}
    Coordinates are normalized (0.0..1.0).
    """
    if not anchors or len(anchors) < 2:
        return None
    
    if len(anchors) == 2:
        # Fallback 2-point transform
        a1, a2 = anchors[0], anchors[1]
        dx_map = a2['map_x'] - a1['map_x']
        dy_map = a2['map_y'] - a1['map_y']
        dx_gps = a2['longitude'] - a1['longitude']
        dy_gps = a2['latitude'] - a1['latitude']
        
        scale_x = dx_gps / dx_map if dx_map != 0 else 0.0
        scale_y = dy_gps / dy_map if dy_map != 0 else 0.0
        
        return {
            'type': 'similarity',
            'scale_x': float(scale_x),
            'scale_y': float(scale_y),
            'offset_x': float(a1['longitude'] - a1['map_x'] * scale_x),
            'offset_y': float(a1['latitude'] - a1['map_y'] * scale_y)
        }
        
    # Least squares for 3+ points
    # GPS_x (lng) = a*x + b*y + c
    # GPS_y (lat) = d*x + e*y + f
    A = []
    b_lng = []
    b_lat = []
    for anchor in anchors:
        A.append([float(anchor['map_x']), float(anchor['map_y']), 1.0])
        b_lng.append(float(anchor['longitude']))
        b_lat.append(float(anchor['latitude']))
        
    A = np.array(A)
    b_lng = np.array(b_lng)
    b_lat = np.array(b_lat)
    
    try:
        params_lng, _, rank, _ = np.linalg.lstsq(A, b_lng, rcond=None)
        params_lat, _, _, _ = np.linalg.lstsq(A, b_lat, rcond=None)
        
        return {
            'type': 'affine',
            'a': float(params_lng[0]), 'b': float(params_lng[1]), 'c': float(params_lng[2]),
            'd': float(params_lat[0]), 'e': float(params_lat[1]), 'f': float(params_lat[2])
        }
    except Exception as e:
        return None
