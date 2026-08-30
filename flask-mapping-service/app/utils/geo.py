import math
import numpy as np
import logging

def get_affine_transform(anchors):
    """
    Computes affine transformation parameters from normalized (x,y) to (lat,lng).
    Requires at least 3 non-collinear anchors.
    """
    if len(anchors) < 3:
        return None
        
    # We want to solve A * X = B
    # A has rows: [x, y, 1]
    # B has rows: [lat, lng]
    A = []
    B = []
    for a in anchors:
        A.append([a['map_x'], a['map_y'], 1])
        B.append([a['latitude'], a['longitude']])
        
    A = np.array(A)
    B = np.array(B)
    
    # Check for collinearity (rank of A should be 3)
    if np.linalg.matrix_rank(A) < 3:
        logging.warning("Anchors are collinear or degenerate; affine transform unstable.")
        return None
        
    # Solve least squares: X is 3x2 matrix
    # X[0] = [a, d]
    # X[1] = [b, e]
    # X[2] = [c, f]
    X, res, rank, s = np.linalg.lstsq(A, B, rcond=None)
    
    return X

def get_inverse_affine_transform(X):
    """
    Invert the 3x2 affine matrix X to map (lat,lng) back to (x,y).
    """
    if X is None: return None
    # lat = a*x + b*y + c
    # lng = d*x + e*y + f
    a, d = X[0]
    b, e = X[1]
    c, f = X[2]
    
    det = a*e - b*d
    if abs(det) < 1e-10:
        return None
        
    # Inverse matrix
    inv_a = e / det
    inv_b = -b / det
    inv_d = -d / det
    inv_e = a / det
    inv_c = (b*f - c*e) / det
    inv_f = (c*d - a*f) / det
    
    return np.array([
        [inv_a, inv_d],
        [inv_b, inv_e],
        [inv_c, inv_f]
    ])

def gps_to_map_xy(lat, lng, anchors):
    """
    Map from Lat/Lng to normalized (x,y) [0.0 to 1.0] using least-squares affine,
    falling back to 2-point similarity if exactly 2 anchors exist.
    """
    if not anchors: return None, None
    
    if len(anchors) == 2:
        return _latlng_to_xy_2point(lat, lng, anchors)
        
    X = get_affine_transform(anchors)
    if X is None:
        return _latlng_to_xy_2point(lat, lng, anchors[:2])
        
    inv_X = get_inverse_affine_transform(X)
    if inv_X is None: return None, None
    
    pt = np.array([lat, lng, 1])
    xy = pt.dot(inv_X)
    return float(xy[0]), float(xy[1])

def map_xy_to_gps(x, y, anchors):
    """
    Map from normalized (x,y) to Lat/Lng.
    """
    if not anchors: return None, None
    
    if len(anchors) == 2:
        return _xy_to_latlng_2point(x, y, anchors)
        
    X = get_affine_transform(anchors)
    if X is None:
        return _xy_to_latlng_2point(x, y, anchors[:2])
        
    pt = np.array([x, y, 1])
    ll = pt.dot(X)
    return float(ll[0]), float(ll[1])

def _get_2point_params(anchors):
    if len(anchors) < 2: return None
    a1, a2 = anchors[0], anchors[1]
    dx = a2['map_x'] - a1['map_x']
    dy = a2['map_y'] - a1['map_y']
    dlat = a2['latitude'] - a1['latitude']
    dlng = a2['longitude'] - a1['longitude']
    
    theta_px = math.atan2(dy, dx) if (dx!=0 or dy!=0) else 0
    theta_geo = math.atan2(dlat, dlng) if (dlat!=0 or dlng!=0) else 0
    theta = theta_geo - theta_px
    
    dist_px = math.sqrt(dx**2 + dy**2)
    dist_geo = math.sqrt(dlng**2 + dlat**2)
    if dist_px == 0: return None
    scale = dist_geo / dist_px
    
    return {
        'x1': a1['map_x'], 'y1': a1['map_y'], 
        'lat1': a1['latitude'], 'lng1': a1['longitude'],
        'theta': theta, 'scale': scale
    }

def _xy_to_latlng_2point(x, y, anchors):
    params = _get_2point_params(anchors)
    if not params: return None, None
    dx = x - params['x1']
    dy = y - params['y1']
    cos_t = math.cos(params['theta'])
    sin_t = math.sin(params['theta'])
    rotated_dx = (dx * cos_t - dy * sin_t) * params['scale']
    rotated_dy = (dx * sin_t + dy * cos_t) * params['scale']
    return params['lat1'] + rotated_dy, params['lng1'] + rotated_dx

def _latlng_to_xy_2point(lat, lng, anchors):
    params = _get_2point_params(anchors)
    if not params: return None, None
    dlng = lng - params['lng1']
    dlat = lat - params['lat1']
    inv_scale = 1.0 / params['scale'] if params['scale'] != 0 else 0
    cos_inv_t = math.cos(-params['theta'])
    sin_inv_t = math.sin(-params['theta'])
    rotated_dlng = (dlng * cos_inv_t - dlat * sin_inv_t) * inv_scale
    rotated_dlat = (dlng * sin_inv_t + dlat * cos_inv_t) * inv_scale
    return params['x1'] + rotated_dlng, params['y1'] + rotated_dlat

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def pixel_to_latlng(x_px, y_px, floor_plan):
    # Backward compatibility stub
    return None, None
