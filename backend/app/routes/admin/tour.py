"""
Admin Virtual Tour management routes.

Provides CRUD for TourNodes and TourEdges, plus marker-placement endpoints
for setting yaw/pitch positions from the admin panorama viewer.

All endpoints require admin authentication.
"""

from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models.tour import TourNode, TourEdge
from app.models.object import MuseumObject
from app.extensions import db

admin_tour_bp = Blueprint('admin_tour', __name__)


# ══════════════════════════════════════════════════════════════════
# TOUR NODES
# ══════════════════════════════════════════════════════════════════

@admin_tour_bp.route('/tour/nodes', methods=['GET'])
@admin_required
def list_tour_nodes():
    museum_id = request.args.get('museum_id')
    query = TourNode.query
    if museum_id:
        query = query.filter_by(museum_id=int(museum_id))
    nodes = query.order_by(TourNode.is_start.desc(), TourNode.id.asc()).all()
    return jsonify({"data": [n.serialize() for n in nodes]})


@admin_tour_bp.route('/tour/nodes/<int:node_id>', methods=['GET'])
@admin_required
def get_tour_node(node_id):
    node = db.session.get(TourNode, node_id)
    if not node:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourNode not found"}}), 404

    data = node.serialize()
    data['edges'] = [e.serialize() for e in node.outgoing_edges]
    data['objects'] = [
        {
            'id': o.id,
            'name': o.name,
            'image': o.image,
            'tour_yaw': o.tour_yaw,
            'tour_pitch': o.tour_pitch,
        }
        for o in node.objects
    ]
    return jsonify({"data": data})


@admin_tour_bp.route('/tour/nodes', methods=['POST'])
@admin_required
def create_tour_node():
    data = request.json or {}
    if not data.get('name') or not data.get('museum_id'):
        return jsonify({"error": {"code": "INVALID_INPUT", "message": "name and museum_id are required"}}), 400

    # If setting this as start, clear existing start
    if data.get('is_start'):
        TourNode.query.filter_by(museum_id=data['museum_id'], is_start=True).update({'is_start': False})

    node = TourNode(
        museum_id=data['museum_id'],
        gallery_id=data.get('gallery_id'),
        name=data['name'],
        description=data.get('description'),
        panorama_url=data.get('panorama_url'),
        compass_bearing_ref=_float_or_none(data.get('compass_bearing_ref')),
        pos_x=_float_or_none(data.get('pos_x')),
        pos_y=_float_or_none(data.get('pos_y')),
        is_start=bool(data.get('is_start', False)),
        tile_status='pending',
    )
    db.session.add(node)
    db.session.commit()
    return jsonify({"data": node.serialize()}), 201


@admin_tour_bp.route('/tour/nodes/<int:node_id>', methods=['PATCH'])
@admin_required
def update_tour_node(node_id):
    node = db.session.get(TourNode, node_id)
    if not node:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourNode not found"}}), 404

    data = request.json or {}

    if 'name' in data:
        node.name = data['name']
    if 'description' in data:
        node.description = data['description']
    if 'gallery_id' in data:
        node.gallery_id = data['gallery_id'] or None
    if 'panorama_url' in data:
        node.panorama_url = data['panorama_url']
    if 'compass_bearing_ref' in data:
        node.compass_bearing_ref = _float_or_none(data['compass_bearing_ref'])
    if 'pos_x' in data:
        node.pos_x = _float_or_none(data['pos_x'])
    if 'pos_y' in data:
        node.pos_y = _float_or_none(data['pos_y'])
    if 'is_start' in data:
        if data['is_start']:
            # Clear existing start for this museum
            TourNode.query.filter_by(museum_id=node.museum_id, is_start=True).update({'is_start': False})
        node.is_start = bool(data['is_start'])

    db.session.commit()
    return jsonify({"data": node.serialize()})


@admin_tour_bp.route('/tour/nodes/<int:node_id>', methods=['DELETE'])
@admin_required
def delete_tour_node(node_id):
    node = db.session.get(TourNode, node_id)
    if not node:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourNode not found"}}), 404

    db.session.delete(node)
    db.session.commit()
    return jsonify({"data": {"success": True}})


# ══════════════════════════════════════════════════════════════════
# TOUR EDGES
# ══════════════════════════════════════════════════════════════════

@admin_tour_bp.route('/tour/edges', methods=['GET'])
@admin_required
def list_tour_edges():
    source_node_id = request.args.get('source_node_id')
    museum_id = request.args.get('museum_id')
    query = TourEdge.query
    if source_node_id:
        query = query.filter_by(source_node_id=int(source_node_id))
    if museum_id:
        query = query.filter_by(museum_id=int(museum_id))
    edges = query.all()
    return jsonify({"data": [e.serialize() for e in edges]})


@admin_tour_bp.route('/tour/edges/<int:edge_id>', methods=['GET'])
@admin_required
def get_tour_edge(edge_id):
    edge = db.session.get(TourEdge, edge_id)
    if not edge:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourEdge not found"}}), 404
    return jsonify({"data": edge.serialize()})


@admin_tour_bp.route('/tour/edges', methods=['POST'])
@admin_required
def create_tour_edge():
    data = request.json or {}
    required = ['museum_id', 'source_node_id', 'target_node_id']
    for field in required:
        if not data.get(field):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": f"{field} is required"}}), 400

    edge = TourEdge(
        museum_id=data['museum_id'],
        source_node_id=data['source_node_id'],
        target_node_id=data['target_node_id'],
        yaw=float(data.get('yaw', 0.0)),
        pitch=float(data.get('pitch', -45.0)),
        facing_yaw=float(data.get('facing_yaw', 0.0)),
        target_entry_yaw=float(data.get('target_entry_yaw', 0.0)),
        label=data.get('label'),
    )
    db.session.add(edge)

    # Optional 2-way return arrow (from destination back to source)
    if data.get('create_return_edge'):
        forward_yaw = float(data.get('yaw', 0.0))
        return_yaw = (forward_yaw + 180.0) % 360.0
        return_edge = TourEdge(
            museum_id=data['museum_id'],
            source_node_id=data['target_node_id'],
            target_node_id=data['source_node_id'],
            yaw=return_yaw,
            pitch=float(data.get('pitch', -45.0)),
            facing_yaw=(return_yaw + 180.0) % 360.0,
            target_entry_yaw=return_yaw,
            label="Return path",
        )
        db.session.add(return_edge)

    db.session.commit()
    return jsonify({"data": edge.serialize()}), 201


@admin_tour_bp.route('/tour/edges/<int:edge_id>', methods=['PATCH'])
@admin_required
def update_tour_edge(edge_id):
    edge = db.session.get(TourEdge, edge_id)
    if not edge:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourEdge not found"}}), 404

    data = request.json or {}

    if 'yaw' in data:
        edge.yaw = float(data['yaw'])
    if 'pitch' in data:
        edge.pitch = float(data['pitch'])
    if 'facing_yaw' in data:
        edge.facing_yaw = float(data['facing_yaw'])
    if 'target_entry_yaw' in data:
        edge.target_entry_yaw = float(data['target_entry_yaw'])
    if 'label' in data:
        edge.label = data['label'] or None
    if 'target_node_id' in data:
        edge.target_node_id = int(data['target_node_id'])

    db.session.commit()
    return jsonify({"data": edge.serialize()})


@admin_tour_bp.route('/tour/edges/<int:edge_id>', methods=['DELETE'])
@admin_required
def delete_tour_edge(edge_id):
    edge = db.session.get(TourEdge, edge_id)
    if not edge:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourEdge not found"}}), 404
    db.session.delete(edge)
    db.session.commit()
    return jsonify({"data": {"success": True}})


# ══════════════════════════════════════════════════════════════════
# MARKER PLACEMENT (for the admin panorama click-to-place UI)
# ══════════════════════════════════════════════════════════════════

@admin_tour_bp.route('/tour/edges/<int:edge_id>/marker', methods=['PATCH'])
@admin_required
def place_edge_marker(edge_id):
    """
    Update only the arrow marker position (yaw, pitch) for a specific edge.
    Called when admin clicks on the panorama to place/reposition an arrow.
    """
    edge = db.session.get(TourEdge, edge_id)
    if not edge:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "TourEdge not found"}}), 404

    data = request.json or {}
    if 'yaw' in data:
        edge.yaw = float(data['yaw'])
    if 'pitch' in data:
        edge.pitch = float(data['pitch'])
    if 'facing_yaw' in data:
        edge.facing_yaw = float(data['facing_yaw'])
    if 'target_entry_yaw' in data:
        edge.target_entry_yaw = float(data['target_entry_yaw'])

    db.session.commit()
    return jsonify({"data": edge.serialize()})


@admin_tour_bp.route('/tour/objects/<int:object_id>/tour-position', methods=['PATCH'])
@admin_required
def update_object_tour_position(object_id):
    """
    Set the panorama marker position, tour node, and angle_photos for an object.
    Also accepts the full curatorial fields for the artifact detail card.
    """
    obj = db.session.get(MuseumObject, object_id)
    if not obj:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Object not found"}}), 404

    data = request.json or {}

    # Tour positioning
    if 'tour_node_id' in data:
        new_node_id = data['tour_node_id'] or None
        obj.tour_node_id = new_node_id
        if not new_node_id:
            obj.tour_yaw = None
            obj.tour_pitch = None
    if 'tour_yaw' in data and obj.tour_node_id is not None:
        obj.tour_yaw = _float_or_none(data['tour_yaw'])
    if 'tour_pitch' in data and obj.tour_node_id is not None:
        obj.tour_pitch = _float_or_none(data['tour_pitch'])
    if 'angle_photos' in data:
        obj.angle_photos = data['angle_photos'] or []

    # Curatorial metadata
    if 'materials' in data:
        obj.materials = data['materials'] or None
    if 'dimensions' in data:
        obj.dimensions = data['dimensions'] or None
    if 'provenance' in data:
        obj.provenance = data['provenance'] or None
    if 'custom_fields' in data:
        obj.custom_fields = data['custom_fields'] or []
    if 'category' in data:
        obj.category = data['category'] or None
    if 'period' in data:
        obj.period = data['period'] or None
    if 'origin' in data:
        obj.origin = data['origin'] or None
    if 'description' in data:
        obj.description = data['description'] or None

    db.session.commit()
    return jsonify({"data": obj.serialize()})


# ── Utilities ────────────────────────────────────────────────────────────────

def _float_or_none(val):
    if val is None or str(val).strip() == '':
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None
