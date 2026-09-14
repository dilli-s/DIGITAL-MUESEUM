import pytest
import math
from app import create_app
from app.models.floor_plan import get_floor_plan_by_id
from app.models.room import get_rooms_by_floor_plan, get_doorways_by_floor_plan
from app.models.map_node import get_all_nodes
from app.models.map_edge import get_all_edges
from app.utils.geometry import point_in_polygon, segment_crosses_any_wall
from app.utils.pathfinding import find_shortest_path

from setup_4rooms_floorplan import setup_4room_plan

PLAN_ID = 'e4000000-0000-0000-0000-000000000099'

@pytest.fixture(scope="module")
def app_ctx():
    app = create_app()
    with app.app_context():
        setup_4room_plan(PLAN_ID)
        yield app
        # Cleanup isolated test plan after tests
        from app.utils.db import execute_query
        execute_query("DELETE FROM map_edges WHERE from_node_id IN (SELECT id FROM map_nodes WHERE floor_plan_id = %s::uuid) OR to_node_id IN (SELECT id FROM map_nodes WHERE floor_plan_id = %s::uuid)", (PLAN_ID, PLAN_ID), commit=True)
        execute_query("DELETE FROM map_nodes WHERE floor_plan_id = %s::uuid", (PLAN_ID,), commit=True)
        execute_query("DELETE FROM artifacts WHERE floor_plan_id = %s::uuid", (PLAN_ID,), commit=True)
        execute_query("DELETE FROM doorway_openings WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)", (PLAN_ID,), commit=True)
        execute_query("DELETE FROM room_boundaries WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)", (PLAN_ID,), commit=True)
        execute_query("DELETE FROM rooms WHERE floor_plan_id = %s::uuid", (PLAN_ID,), commit=True)
        execute_query("DELETE FROM floor_plans WHERE id = %s::uuid", (PLAN_ID,), commit=True)

def test_4room_floor_plan_registered(app_ctx):
    fp = get_floor_plan_by_id(PLAN_ID)
    assert fp is not None, f"Floor plan {PLAN_ID} must exist"
    assert fp["width_px"] == 1024
    assert fp["height_px"] == 768
    assert fp["scale_meters_per_px"] == 0.15

def test_4room_rooms_and_doorways(app_ctx):
    rooms = get_rooms_by_floor_plan(PLAN_ID)
    assert len(rooms) == 4, f"Expected 4 rooms, got {len(rooms)}"
    room_names = {r["name"] for r in rooms}
    assert room_names == {"Living Room", "Kitchen", "Bedroom", "Bath"}

    doorways = get_doorways_by_floor_plan(PLAN_ID)
    assert len(doorways) == 4, f"Expected 4 doorways, got {len(doorways)}"

def test_4room_4_exhibit_objects(app_ctx):
    nodes = get_all_nodes(floor_plan_id=PLAN_ID)
    exhibits = [n for n in nodes if n.get("node_type") == "exhibit"]
    assert len(exhibits) == 4, f"Expected 4 exhibit objects, got {len(exhibits)}"

    exhibit_names = {e["name"] for e in exhibits}
    expected = {
        "Antique Bronze Culinary Urn",
        "Imperial Silk Canopy Bed",
        "Classical Marble Ritual Basin",
        "Royal Crystal Chandelier"
    }
    assert exhibit_names == expected

def test_4room_edge_distances_minimum_10_meters(app_ctx):
    edges = get_all_edges(floor_plan_id=PLAN_ID)
    assert len(edges) >= 18, "Should have at least 18 directed edges"
    for e in edges:
        dist = float(e.get("distance") or 0.0)
        assert dist >= 10.0, f"Edge {e['from_node_id']} -> {e['to_node_id']} distance {dist}m is less than 10.0m!"

def test_4room_strict_room_routing_through_living_room(app_ctx):
    nodes = get_all_nodes(floor_plan_id=PLAN_ID)
    edges = get_all_edges(floor_plan_id=PLAN_ID)
    nodes_dict = {str(n["id"]): n for n in nodes}
    nodes_by_name = {n["name"]: str(n["id"]) for n in nodes}

    # 1. From Entrance to Bedroom Canopy
    ent_id = nodes_by_name["Main Entrance"]
    bed_id = nodes_by_name["Imperial Silk Canopy Bed"]
    path, dist, _ = find_shortest_path(ent_id, bed_id, nodes_dict, edges)
    step_names = [n["name"] for n in path]
    assert step_names == [
        "Main Entrance",
        "Living Room Foyer",
        "Living Room Central Hub",
        "Bedroom Doorway",
        "Imperial Silk Canopy Bed"
    ]
    assert dist > 70.0

    # 2. Cross-room routing: Kitchen to Bedroom must route through Living Room
    k_id = nodes_by_name["Antique Bronze Culinary Urn"]
    b_id = nodes_by_name["Imperial Silk Canopy Bed"]
    path, dist, _ = find_shortest_path(k_id, b_id, nodes_dict, edges)
    step_names = [n["name"] for n in path]
    assert "Living Room Central Hub" in step_names
    assert "Kitchen Doorway" in step_names
    assert "Bedroom Doorway" in step_names

    # 3. Cross-room routing: Bath to Kitchen must route through Living Room
    bath_id = nodes_by_name["Classical Marble Ritual Basin"]
    path, dist, _ = find_shortest_path(bath_id, k_id, nodes_dict, edges)
    step_names = [n["name"] for n in path]
    assert "Living Room Central Hub" in step_names
    assert "Bath Doorway" in step_names
    assert "Kitchen Doorway" in step_names
