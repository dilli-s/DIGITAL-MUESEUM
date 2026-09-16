try:
    import pytest
    HAVE_PYTEST = True
except ImportError:
    pytest = None
    HAVE_PYTEST = False

from app import create_app
from app.models.floor_plan import get_floor_plan_by_id
from app.models.room import get_rooms_by_floor_plan, get_doorways_by_floor_plan
from app.models.map_node import get_all_nodes
from app.models.map_edge import get_all_edges
from app.models.artifact import get_artifacts
from app.utils.pathfinding import find_shortest_path
from app.utils.geometry import segment_crosses_any_wall

from setup_oriental_institute_floorplan import setup_oriental_institute_plan, PLAN_ID

if HAVE_PYTEST:
    @pytest.fixture(scope="module")
    def app_ctx():
        app = create_app()
        with app.app_context():
            # Setup the floor plan
            setup_oriental_institute_plan(PLAN_ID, wipe_all_old_plans=False)
            yield app
else:
    app_ctx = None

def test_oriental_institute_floor_plan_registered(app_ctx):
    fp = get_floor_plan_by_id(PLAN_ID)
    assert fp is not None, f"Floor plan {PLAN_ID} must exist"
    assert fp["width_px"] == 832
    assert fp["height_px"] == 1024
    assert fp["scale_meters_per_px"] == 0.08
    assert "oriental_institute_floorplan.png" in fp["image_url"]

def test_oriental_institute_15_rooms_and_doorways(app_ctx):
    rooms = get_rooms_by_floor_plan(PLAN_ID)
    assert len(rooms) == 15, f"Expected 15 rooms, got {len(rooms)}"
    room_names = {r["name"] for r in rooms}
    expected_rooms = {
        "Lobby", "Museum Store", "Visitor Orientation", "Prehistory",
        "Mesopotamia", "Khorsabad Court", "Assyria", "Syria & Anatolia",
        "Megiddo", "Courtyard", "Egypt", "Nubia", "Temporary Exhibits",
        "Breasted Lecture Hall", "Persia"
    }
    assert room_names == expected_rooms

    doorways = get_doorways_by_floor_plan(PLAN_ID)
    assert len(doorways) >= 15, f"Expected at least 15 doorways, got {len(doorways)}"

def test_oriental_institute_authentic_artifacts(app_ctx):
    artifacts = get_artifacts(PLAN_ID)
    assert len(artifacts) >= 18, f"Expected at least 18 artifacts, got {len(artifacts)}"
    artifact_names = {a["name"] for a in artifacts}
    assert "Colossal 17-Foot Statue of King Tutankhamun" in artifact_names
    assert "Colossal Winged Bull (Lamassu) of King Sargon II" in artifact_names
    assert "Statue of a Sumerian Worshiper from Tell Asmar" in artifact_names
    assert "Persepolis Column Capital with Double Bull Protome" in artifact_names
    assert "The Megiddo Ivories: Royal Treasury Plaque" in artifact_names

def test_oriental_institute_edge_wall_clearance(app_ctx):
    rooms = get_rooms_by_floor_plan(PLAN_ID)
    doorways = get_doorways_by_floor_plan(PLAN_ID)
    nodes = get_all_nodes(floor_plan_id=PLAN_ID)
    edges = get_all_edges(floor_plan_id=PLAN_ID)
    nodes_dict = {str(n["id"]): n for n in nodes}

    assert len(edges) >= 100, f"Expected >= 100 directed edges, got {len(edges)}"

    for e in edges:
        u = nodes_dict.get(str(e["from_node_id"]))
        v = nodes_dict.get(str(e["to_node_id"]))
        if not u or not v:
            continue
        ux, uy = float(u["x_coordinate"]), float(u["y_coordinate"])
        vx, vy = float(v["x_coordinate"]), float(v["y_coordinate"])
        crosses = segment_crosses_any_wall(ux, uy, vx, vy, rooms, doorways, door_tolerance=0.08)
        assert not crosses, f"Illegal wall crossing on edge {u['name']} <-> {v['name']}!"

def test_oriental_institute_navigation_routes(app_ctx):
    nodes = get_all_nodes(floor_plan_id=PLAN_ID)
    edges = get_all_edges(floor_plan_id=PLAN_ID)
    nodes_dict = {str(n["id"]): n for n in nodes}
    nodes_by_name = {n["name"]: str(n["id"]) for n in nodes}

    # Route 1: Entrance -> Tutankhamun in Egypt
    ent_id = nodes_by_name["Main Entrance Threshold"]
    tut_id = nodes_by_name["Colossal 17-Foot Statue of King Tutankhamun"]
    path1, dist1, inst1 = find_shortest_path(ent_id, tut_id, nodes_dict, edges)
    assert path1 is not None and len(path1) >= 8
    assert dist1 > 50.0
    assert len(inst1) > 0

    # Route 2: Entrance -> Lamassu in Khorsabad Court
    lam_id = nodes_by_name["Colossal Winged Bull (Lamassu) of King Sargon II"]
    path2, dist2, inst2 = find_shortest_path(ent_id, lam_id, nodes_dict, edges)
    assert path2 is not None and len(path2) >= 8
    assert any("Mesopotamia Gallery" in n["name"] for n in path2)
    assert "Khorsabad Court Center" in [n["name"] for n in path2]

    # Route 3: Prehistory -> Persia
    jarmo_id = nodes_by_name["Jarmo Clay Mother Goddess Figurine"]
    persia_id = nodes_by_name["Persepolis Column Capital with Double Bull Protome"]
    path3, dist3, inst3 = find_shortest_path(jarmo_id, persia_id, nodes_dict, edges)
    assert path3 is not None and len(path3) >= 8
    assert "Persia Gallery Center" in [n["name"] for n in path3]


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        setup_oriental_institute_plan(PLAN_ID, wipe_all_old_plans=False)
        print("Running test_oriental_institute_floor_plan_registered...")
        test_oriental_institute_floor_plan_registered(None)
        print("Running test_oriental_institute_15_rooms_and_doorways...")
        test_oriental_institute_15_rooms_and_doorways(None)
        print("Running test_oriental_institute_authentic_artifacts...")
        test_oriental_institute_authentic_artifacts(None)
        print("Running test_oriental_institute_edge_wall_clearance...")
        test_oriental_institute_edge_wall_clearance(None)
        print("Running test_oriental_institute_navigation_routes...")
        test_oriental_institute_navigation_routes(None)
        print("All Oriental Institute tests passed successfully!")
