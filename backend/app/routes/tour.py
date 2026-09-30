"""
Public Virtual Tour API routes.

These endpoints are read-only and require no authentication — they serve
museum visitors browsing the 360° tour on their phones.

Endpoints:
  GET /api/tour/museums/<museum_id>/start   — entry point for the museum tour
  GET /api/tour/node/<node_id>              — full node data: edges + objects
  GET /api/tour/object/<object_id>          — full artifact detail for the card
"""

from flask import Blueprint, jsonify
from app.models.tour import TourNode, TourEdge
from app.models.object import MuseumObject
from app.extensions import db

tour_bp = Blueprint('tour', __name__)


@tour_bp.route('/museums/<int:museum_id>/start', methods=['GET'])
def get_tour_start(museum_id):
    """Return the starting TourNode for a museum's virtual tour."""
    # Prefer is_start=True, then fall back to lowest ID
    node = TourNode.query.filter_by(
        museum_id=museum_id,
        is_start=True
    ).first()

    if not node:
        node = TourNode.query.filter_by(
            museum_id=museum_id
        ).order_by(TourNode.id.asc()).first()

    if not node:
        return jsonify({
            "error": {
                "code": "NOT_FOUND",
                "message": "No tour nodes found for this museum. Please add panorama nodes in the admin panel."
            }
        }), 404

    return jsonify({"data": _serialize_node_full(node)})


@tour_bp.route('/museums/<int:museum_id>/nodes', methods=['GET'])
def list_museum_nodes(museum_id):
    """
    Return all TourNodes for a museum — lightweight list for the map page.
    Includes outgoing edge stubs so the map can draw connections.
    """
    nodes = TourNode.query.filter_by(museum_id=museum_id).order_by(TourNode.is_start.desc(), TourNode.id.asc()).all()
    result = []
    for node in nodes:
        data = node.serialize()
        data['outgoing_edges'] = [
            {'id': e.id, 'target_node_id': e.target_node_id}
            for e in node.outgoing_edges
        ]
        result.append(data)
    return jsonify({"data": result})


@tour_bp.route('/node/<int:node_id>', methods=['GET'])
def get_tour_node(node_id):
    """
    Return full data for a single TourNode:
      - panorama URL / tile info
      - outgoing edges (navigation arrows)
      - objects at this node (marker positions + thumbnails)
    """
    node = db.session.get(TourNode, node_id)
    if not node:
        return jsonify({
            "error": {"code": "NOT_FOUND", "message": "Tour node not found"}
        }), 404

    return jsonify({"data": _serialize_node_full(node)})


@tour_bp.route('/object/<int:object_id>', methods=['GET'])
def get_tour_object(object_id):
    """
    Return full artifact detail for the in-tour detail card.
    Only returns fields that have actual data (no nulls / empty strings).
    """
    obj = db.session.get(MuseumObject, object_id)
    if not obj:
        return jsonify({
            "error": {"code": "NOT_FOUND", "message": "Object not found"}
        }), 404

    return jsonify({"data": _serialize_object_detail(obj)})


# ── Helpers ─────────────────────────────────────────────────────────────────

def _serialize_node_full(node: TourNode) -> dict:
    """Serialize a TourNode with its edges and object markers."""
    return {
        "id": node.id,
        "museum_id": node.museum_id,
        "gallery_id": node.gallery_id,
        "name": node.name,
        "description": node.description,
        "panorama_url": node.panorama_url,
        "tile_status": node.tile_status,
        "tile_base_url": node.tile_base_url,
        "tile_config": node.tile_config,
        "compass_bearing_ref": node.compass_bearing_ref,
        "is_start": node.is_start,
        "edges": [_serialize_edge(e) for e in node.outgoing_edges],
        "objects": [
            _serialize_object_stub(o)
            for o in node.objects
            if o.tour_yaw is not None and o.tour_pitch is not None
        ],
    }


def _serialize_edge(edge: TourEdge) -> dict:
    """Serialize a TourEdge for arrow rendering."""
    return {
        "id": edge.id,
        "source_node_id": edge.source_node_id,
        "target_node_id": edge.target_node_id,
        "target_node_name": edge.target_node.name if edge.target_node else None,
        "yaw": edge.yaw,
        "pitch": edge.pitch,
        "facing_yaw": edge.facing_yaw,
        "target_entry_yaw": edge.target_entry_yaw,
        "label": edge.label,
    }


def _serialize_object_stub(obj: MuseumObject) -> dict:
    """Minimal object data for the in-panorama marker."""
    return {
        "id": obj.id,
        "name": obj.name,
        "category": obj.category,
        "image": obj.image,
        "tour_yaw": obj.tour_yaw,
        "tour_pitch": obj.tour_pitch,
    }


def _serialize_object_detail(obj: MuseumObject) -> dict:
    """
    Full object detail for the artifact card.
    Omits fields that are None/empty — callers can render only what's present.
    """
    data = {
        "id": obj.id,
        "name": obj.name,
    }

    # Only include fields that have real data
    if obj.category:
        data["category"] = obj.category
    if obj.period:
        data["period_era"] = obj.period   # period column mapped to period_era label
    if obj.origin:
        data["origin"] = obj.origin
    if obj.provenance:
        data["provenance"] = obj.provenance
    if obj.materials:
        data["materials"] = obj.materials
    if obj.dimensions:
        data["dimensions"] = obj.dimensions
    if obj.description:
        data["description"] = obj.description
    if obj.significance:
        data["significance"] = obj.significance
    if obj.custom_fields:
        # Filter out entries with empty values
        filled = [f for f in obj.custom_fields if f.get('key') and f.get('value')]
        if filled:
            data["custom_fields"] = filled
    if obj.angle_photos:
        data["angle_photos"] = obj.angle_photos
    if obj.image:
        data["image"] = obj.image

    return data
