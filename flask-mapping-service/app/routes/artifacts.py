from flask import Blueprint, request, jsonify
from app.models.artifact import create_artifact, get_artifacts, get_artifact, update_artifact, delete_artifact
import logging

artifacts_bp = Blueprint('artifacts', __name__)

@artifacts_bp.route('/artifacts', methods=['POST'])
def add_artifact():
    data = request.json
    try:
        art = create_artifact(data)

        # Ensure the artifact is also synchronized in objects table if not already present
        try:
            from app.utils.db import execute_query
            name = (data.get('name') or '').strip()
            if name:
                existing_obj = execute_query(
                    "SELECT id FROM objects WHERE name ILIKE %s LIMIT 1",
                    (name,),
                    fetchone=True
                )
                if not existing_obj:
                    museum_id = None
                    fp_id = data.get('floor_plan_id')
                    if fp_id:
                        fp_row = execute_query("SELECT museum_id FROM floor_plans WHERE id = %s::uuid", (fp_id,), fetchone=True)
                        if fp_row and fp_row[0]:
                            museum_id = fp_row[0]
                    if not museum_id:
                        m_row = execute_query("SELECT id FROM museums ORDER BY id LIMIT 1", fetchone=True)
                        if m_row:
                            museum_id = m_row[0]

                    if museum_id:
                        lat = data.get('latitude')
                        lng = data.get('longitude')
                        execute_query(
                            """
                            INSERT INTO objects (name, description, museum_id, latitude, longitude, category)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """,
                            (name, data.get('description'), museum_id, lat, lng, 'Exhibit'),
                            commit=True
                        )
                        logging.info(f"Synchronized artifact '{name}' to objects table for museum {museum_id}")
        except Exception as sync_err:
            logging.warning(f"Could not auto-sync artifact to objects table: {sync_err}")

        return jsonify({"data": art}), 201
    except Exception as e:
        logging.error(f"Error adding artifact: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@artifacts_bp.route('/artifacts', methods=['GET'])
def list_artifacts():
    floor_plan_id = request.args.get('floor_plan_id')
    try:
        arts = get_artifacts(floor_plan_id)
        return jsonify({"data": arts}), 200
    except Exception as e:
        logging.error(f"Error fetching artifacts: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@artifacts_bp.route('/artifacts/<artifact_id>', methods=['GET'])
def get_single_artifact(artifact_id):
    try:
        art = get_artifact(artifact_id)
        if not art:
            return jsonify({"error": "Not found"}), 404
        return jsonify({"data": art}), 200
    except Exception as e:
        logging.error(f"Error fetching artifact: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@artifacts_bp.route('/artifacts/<artifact_id>', methods=['PUT'])
def edit_artifact(artifact_id):
    data = request.json
    try:
        art = update_artifact(artifact_id, data)
        if not art:
            return jsonify({"error": "Not found"}), 404
        return jsonify({"data": art}), 200
    except Exception as e:
        logging.error(f"Error updating artifact: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@artifacts_bp.route('/artifacts/<artifact_id>', methods=['DELETE'])
def remove_artifact(artifact_id):
    try:
        success = delete_artifact(artifact_id)
        if not success:
            return jsonify({"error": "Not found"}), 404
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.error(f"Error deleting artifact: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

@artifacts_bp.route('/artifacts/<artifact_id>/location', methods=['PUT'])
def update_artifact_location(artifact_id):
    data = request.json
    try:
        art = update_artifact(artifact_id, {
            'map_x': data.get('map_x'),
            'map_y': data.get('map_y'),
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude')
        })
        if not art:
            return jsonify({"error": "Not found"}), 404
        return jsonify({"data": art}), 200
    except Exception as e:
        logging.error(f"Error updating artifact location: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
        
@artifacts_bp.route('/artifacts/nearby', methods=['GET'])
def get_nearby_artifacts():
    floor_plan_id = request.args.get('floor_plan_id')
    x = float(request.args.get('x', 0))
    y = float(request.args.get('y', 0))
    radius_m = float(request.args.get('radius_m', 15))
    
    try:
        # Simplified nearby logic using map_x/map_y approx. In production, 
        # convert normalized distances to meters using a known scale.
        # Here we just fetch all for the floor and sort by euclidean * scale.
        from app.models.floor_plan import get_floor_plan_by_id
        floor = get_floor_plan_by_id(floor_plan_id)
        scale = floor.get('scale_meters_per_px', 1) if floor else 1 
        # Assuming floor_plan width is roughly 100 meters for example, or actual scale.
        # This requires robust scale logic. We will just use the haversine on lat/lng if available.
        arts = get_artifacts(floor_plan_id)
        
        from app.utils.geo import haversine_distance
        results = []
        lat_arg = request.args.get('lat')
        lng_arg = request.args.get('lng')
        user_lat = float(lat_arg) if lat_arg is not None else None
        user_lng = float(lng_arg) if lng_arg is not None else None

        for a in arts:
            # use lat/lng if both are available, else fallback
            if a.get('latitude') is not None and a.get('longitude') is not None and user_lat is not None and user_lng is not None:
                dist = haversine_distance(user_lat, user_lng, float(a['latitude']), float(a['longitude']))
            else:
                import math
                # heuristic fallback
                art_x = float(a.get('map_x') or 0.0)
                art_y = float(a.get('map_y') or 0.0)
                dx = (art_x - x) * 100 # assume 100m map width roughly
                dy = (art_y - y) * 100
                dist = math.sqrt(dx*dx + dy*dy)
                
            if dist <= radius_m:
                a['distance_m'] = dist
                results.append(a)
                
        results.sort(key=lambda item: item['distance_m'])
        return jsonify({"data": results}), 200
    except Exception as e:
        logging.error(f"Error getting nearby artifacts: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
