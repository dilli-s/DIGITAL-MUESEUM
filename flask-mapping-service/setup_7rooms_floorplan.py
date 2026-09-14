import math
import uuid
from app import create_app
from app.utils.db import execute_query
from app.models.floor_plan import get_floor_plan_by_id
from app.utils.geo import map_xy_to_gps, haversine_distance

app = create_app()

PLAN_IDS = [
    '130886ad-9e4b-485a-8bd4-29ab2ae6ce5c', # National History Museum -> main hall
    'bf312c0e-b70e-45cb-b307-6c5f75b6641d', # Museum of Modern Art -> ROOM
]

def setup_plan(PLAN_ID):
    fp = get_floor_plan_by_id(PLAN_ID)
    if not fp:
        print(f"Floor plan {PLAN_ID} not found, skipping.")
        return

    w = float(fp.get("width_px") or 613.0)
    h = float(fp.get("height_px") or 370.0)
    scale = float(fp.get("scale_meters_per_px") or 0.2)
    floor_num = int(fp.get("floor_number") or 1)
    museum_id = int(fp.get("museum_id") or 1)

    print(f"\n=======================================================")
    print(f"Applying Floor Plan setup for '{fp['name']}' ({PLAN_ID})...")
    print(f"Dimensions: {w}x{h}, Scale: {scale}m/px, Floor: {floor_num}, Museum: {museum_id}")

    # 1. Clean up existing stale nodes, edges, doorways, and rooms for this floor plan
    print("Clearing old edges, nodes, doorways, and rooms...")
    execute_query(
        "DELETE FROM map_edges WHERE from_node_id IN (SELECT id FROM map_nodes WHERE floor_plan_id = %s::uuid) "
        "OR to_node_id IN (SELECT id FROM map_nodes WHERE floor_plan_id = %s::uuid)",
        (PLAN_ID, PLAN_ID),
        commit=True
    )
    execute_query("DELETE FROM map_nodes WHERE floor_plan_id = %s::uuid", (PLAN_ID,), commit=True)
    execute_query(
        "DELETE FROM doorway_openings WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)",
        (PLAN_ID,),
        commit=True
    )
    execute_query(
        "DELETE FROM room_boundaries WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)",
        (PLAN_ID,),
        commit=True
    )
    execute_query("DELETE FROM rooms WHERE floor_plan_id = %s::uuid", (PLAN_ID,), commit=True)

    # 2. Define the 7 Rooms and their exact boundaries
    rooms_data = [
        {
            "name": "Stair Landing",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.1240, 0.1081),
                (0.2626, 0.1081),
                (0.2626, 0.9000),
                (0.1240, 0.9000),
            ]
        },
        {
            "name": "Kitchen",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.2626, 0.0405),
                (0.4617, 0.0405),
                (0.4617, 0.5135),
                (0.2626, 0.5135),
            ]
        },
        {
            "name": "Bedroom 2",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.4617, 0.1081),
                (0.6884, 0.1081),
                (0.6884, 0.5135),
                (0.4617, 0.5135),
            ]
        },
        {
            "name": "Bedroom 1",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.6884, 0.1081),
                (0.9152, 0.1081),
                (0.9152, 0.6486),
                (0.6884, 0.6486),
            ]
        },
        {
            "name": "Main Hall",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.2626, 0.5135),
                (0.6884, 0.5135),
                (0.6884, 0.6486),
                (0.6215, 0.6486),
                (0.6215, 0.9000),
                (0.2626, 0.9000),
            ]
        },
        {
            "name": "Bathroom 1",
            "type": "restroom",
            "walkable": True,
            "boundaries": [
                (0.6215, 0.6486),
                (0.7635, 0.6486),
                (0.7635, 0.9000),
                (0.6215, 0.9000),
            ]
        },
        {
            "name": "Bathroom 2",
            "type": "restroom",
            "walkable": True,
            "boundaries": [
                (0.7635, 0.6486),
                (0.9152, 0.6486),
                (0.9152, 0.9000),
                (0.7635, 0.9000),
            ]
        },
    ]

    room_ids = {}
    for r in rooms_data:
        r_row = execute_query(
            "INSERT INTO rooms (floor_plan_id, name, room_type, walkable) VALUES (%s::uuid, %s, %s, %s) RETURNING id",
            (PLAN_ID, r["name"], r["type"], r["walkable"]),
            fetchone=True,
            commit=True
        )
        r_id = str(r_row[0])
        room_ids[r["name"]] = r_id

        for idx, (bx, by) in enumerate(r["boundaries"]):
            lat, lng = map_xy_to_gps(bx, by, fp)
            execute_query(
                "INSERT INTO room_boundaries (room_id, corner_order, x, y, latitude, longitude) "
                "VALUES (%s::uuid, %s, %s, %s, %s, %s)",
                (r_id, idx, bx, by, lat, lng),
                commit=True
            )
    print(f"Created 7 rooms: {list(room_ids.keys())}")

    # 3. Define the Doorways connecting rooms
    doorways_data = [
        {
            "name": "Stair Landing ↔ Main Hall",
            "room_a": "Stair Landing",
            "room_b": "Main Hall",
            "x1": 0.2626, "y1": 0.6757, "x2": 0.2626, "y2": 0.7568,
            "center": (0.2626, 0.7162)
        },
        {
            "name": "Main Hall ↔ Kitchen",
            "room_a": "Main Hall",
            "room_b": "Kitchen",
            "x1": 0.3915, "y1": 0.5135, "x2": 0.4405, "y2": 0.5135,
            "center": (0.4160, 0.5135)
        },
        {
            "name": "Kitchen ↔ Balcony",
            "room_a": "Kitchen",
            "room_b": None,
            "x1": 0.3915, "y1": 0.1081, "x2": 0.4405, "y2": 0.1081,
            "center": (0.4160, 0.1081)
        },
        {
            "name": "Main Hall ↔ Bedroom 2",
            "room_a": "Main Hall",
            "room_b": "Bedroom 2",
            "x1": 0.4894, "y1": 0.5135, "x2": 0.5383, "y2": 0.5135,
            "center": (0.5090, 0.5135)
        },
        {
            "name": "Main Hall ↔ Bedroom 1",
            "room_a": "Main Hall",
            "room_b": "Bedroom 1",
            "x1": 0.6884, "y1": 0.5405, "x2": 0.6884, "y2": 0.6216,
            "center": (0.6884, 0.5811)
        },
        {
            "name": "Main Hall ↔ Bathroom 1",
            "room_a": "Main Hall",
            "room_b": "Bathroom 1",
            "x1": 0.6215, "y1": 0.6486, "x2": 0.6215, "y2": 0.7297,
            "center": (0.6215, 0.6892)
        },
        {
            "name": "Bedroom 1 ↔ Bathroom 2",
            "room_a": "Bedroom 1",
            "room_b": "Bathroom 2",
            "x1": 0.8157, "y1": 0.6486, "x2": 0.8711, "y2": 0.6486,
            "center": (0.8434, 0.6486)
        },
    ]

    for d in doorways_data:
        r_a_id = room_ids[d["room_a"]]
        r_b_id = room_ids[d["room_b"]] if d["room_b"] else None
        execute_query(
            "INSERT INTO doorway_openings (room_id, x1, y1, x2, y2, connected_room_id, name) "
            "VALUES (%s::uuid, %s, %s, %s, %s, %s::uuid, %s)",
            (r_a_id, d["x1"], d["y1"], d["x2"], d["y2"], r_b_id, d["name"]),
            commit=True
        )
        if r_b_id:
            execute_query(
                "INSERT INTO doorway_openings (room_id, x1, y1, x2, y2, connected_room_id, name) "
                "VALUES (%s::uuid, %s, %s, %s, %s, %s::uuid, %s)",
                (r_b_id, d["x1"], d["y1"], d["x2"], d["y2"], r_a_id, d["name"]),
                commit=True
            )
    print(f"Created {len(doorways_data)} doorway openings.")

    # 4. Define Objects and Waypoints with ~10m spacing
    # Note: 50 pixels = 10.0 meters (50 * 0.2m = 10.0m)
    nodes_spec = [
        # --- Stair Landing ---
        {"key": "stair_mosaic", "name": "Ancient Stair Mosaic", "type": "exhibit", "x": 0.1810, "y": 0.7162, "desc": "Intricate classical Roman mosaic discovered beneath the landing floor."},
        {"key": "door_stair_hall", "name": "Stair Landing ↔ Main Hall", "type": "entrance", "x": 0.2626, "y": 0.7162, "desc": "Grand double-door entrance into the main residence."},

        # --- Main Hall ---
        {"key": "hall_centerpiece", "name": "Living Room Centerpiece", "type": "exhibit", "x": 0.3442, "y": 0.7162, "desc": "18th-century carved walnut parlor suite with gilt bronze mounts."},
        {"key": "hall_dining", "name": "Dining Table Exhibit", "type": "exhibit", "x": 0.3442, "y": 0.5811, "desc": "Renaissance banquet table set with silver and Venetian glassware."},
        {"key": "door_kitchen", "name": "Main Hall ↔ Kitchen", "type": "entrance", "x": 0.4160, "y": 0.5135, "desc": "Arched entry leading into the culinary hearth."},

        {"key": "hall_tapestry", "name": "Grand Tapestry", "type": "exhibit", "x": 0.4258, "y": 0.7162, "desc": "Flemish wall hanging depicting pastoral mythological scenes."},
        {"key": "hall_wp_bed2", "name": "Bedroom 2 Alcove", "type": "hallway", "x": 0.4674, "y": 0.6148, "desc": "Transition vestibule connecting Main Hall to Bedroom 2."},
        {"key": "door_bed2", "name": "Main Hall ↔ Bedroom 2", "type": "entrance", "x": 0.5090, "y": 0.5135, "desc": "Wooden paneled door to the second bedchamber."},

        {"key": "hall_statue", "name": "Historic Bronze Statue", "type": "exhibit", "x": 0.5236, "y": 0.7027, "desc": "Cast bronze sculpture of Hermes resting on a marble plinth."},
        {"key": "hall_chandelier", "name": "Hallway Chandelier", "type": "exhibit", "x": 0.6060, "y": 0.6419, "desc": "Prismatic crystal chandelier illuminating the east wing corridor."},
        {"key": "door_bath1", "name": "Main Hall ↔ Bathroom 1", "type": "entrance", "x": 0.6215, "y": 0.6892, "desc": "Door opening into the main guest bath."},
        {"key": "door_bed1", "name": "Main Hall ↔ Bedroom 1", "type": "entrance", "x": 0.6884, "y": 0.5811, "desc": "Curved archway opening into the Master Bedroom suite."},

        # --- Kitchen ---
        {"key": "k_cookware", "name": "Antique Copper Cookware", "type": "exhibit", "x": 0.4160, "y": 0.3784, "desc": "Hand-hammered French copper pots and pans dating to 1840."},
        {"key": "k_hearth", "name": "Stone Hearth Oven", "type": "exhibit", "x": 0.3344, "y": 0.3784, "desc": "Original masonry wood-fired baking oven with iron spit."},
        {"key": "k_spices", "name": "Vintage Spice Rack", "type": "exhibit", "x": 0.4160, "y": 0.2432, "desc": "Silk road spice apothecary cabinet with hand-labeled porcelain drawers."},
        {"key": "door_balcony", "name": "Kitchen ↔ Balcony", "type": "exit", "x": 0.4160, "y": 0.1081, "desc": "Exit door opening outward to the private kitchen balcony."},

        # --- Bedroom 2 ---
        {"key": "b2_canopy", "name": "Royal Canopy Bed", "type": "exhibit", "x": 0.5090, "y": 0.3784, "desc": "Carved mahogany four-poster bed with embroidered velvet drapery."},
        {"key": "b2_wardrobe", "name": "Carved Rosewood Wardrobe", "type": "exhibit", "x": 0.5906, "y": 0.3784, "desc": "Victorian twin-mirrored wardrobe with inlaid mother-of-pearl accents."},
        {"key": "b2_desk", "name": "Antique Writing Desk", "type": "exhibit", "x": 0.5906, "y": 0.2432, "desc": "Slant-front bureau desk with secret compartments and brass hardware."},

        # --- Bedroom 1 (Master) ---
        {"key": "b1_master_bed", "name": "Master Bed Exhibit", "type": "exhibit", "x": 0.7700, "y": 0.5811, "desc": "Grand Rococo king-sized bedstead with gilded headboard."},
        {"key": "b1_armoire", "name": "Antique Armoire", "type": "exhibit", "x": 0.7700, "y": 0.4460, "desc": "French provincial armoire with carved acanthus leaves."},
        {"key": "b1_screen", "name": "Silk Dressing Screen", "type": "exhibit", "x": 0.8516, "y": 0.4460, "desc": "Four-panel silk hand-painted Japanese folding partition."},
        {"key": "b1_vanity", "name": "Victorian Vanity Table", "type": "exhibit", "x": 0.8516, "y": 0.3108, "desc": "Dressing table equipped with tri-fold beveled mirror and ivory brushes."},
        {"key": "door_bath2", "name": "Bedroom 1 ↔ Bathroom 2", "type": "entrance", "x": 0.8434, "y": 0.6486, "desc": "Private en-suite door connecting Master Bedroom to Bathroom 2."},

        # --- Bathroom 1 ---
        {"key": "bath1_tub", "name": "Clawfoot Bathtub", "type": "exhibit", "x": 0.7031, "y": 0.6892, "desc": "Cast-iron porcelain enameled bathtub resting on gilded lion paws."},
        {"key": "bath1_basin", "name": "Marble Wash Basin", "type": "exhibit", "x": 0.7031, "y": 0.8243, "desc": "Italian Carrara marble washstand with antique copper faucets."},

        # --- Bathroom 2 ---
        {"key": "bath2_washstand", "name": "Porcelain Washstand", "type": "exhibit", "x": 0.8434, "y": 0.7838, "desc": "Decorative Delft blue ceramic wash basin with hand-painted floral motifs."},
    ]

    node_db_ids = {}
    for n in nodes_spec:
        lat, lng = map_xy_to_gps(n["x"], n["y"], fp)

        # Also create or link an artifact in artifacts table if it's an exhibit
        art_id = None
        if n["type"] == "exhibit":
            art_row = execute_query(
                "INSERT INTO artifacts (floor_plan_id, name, description, map_x, map_y, latitude, longitude) "
                "VALUES (%s::uuid, %s, %s, %s, %s, %s, %s) RETURNING id",
                (PLAN_ID, n["name"], n["desc"], n["x"], n["y"], lat, lng),
                fetchone=True,
                commit=True
            )
            art_id = str(art_row[0]) if art_row else None

        n_row = execute_query(
            "INSERT INTO map_nodes (name, floor, x_coordinate, y_coordinate, node_type, floor_plan_id, latitude, longitude, artifact_id) "
            "VALUES (%s, %s, %s, %s, %s, %s::uuid, %s, %s, %s::uuid) RETURNING id",
            (n["name"], floor_num, n["x"], n["y"], n["type"], PLAN_ID, lat, lng, art_id),
            fetchone=True,
            commit=True
        )
        node_db_ids[n["key"]] = str(n_row[0])

    print(f"Created {len(node_db_ids)} map nodes.")

    # 5. Define Connections (Edges) where every edge is nearly 10m (~9.5m - 11m)
    edges_spec = [
        # Stair Landing to Main Hall
        ("stair_mosaic", "door_stair_hall"),
        ("door_stair_hall", "hall_centerpiece"),

        # Main Hall Spine to Kitchen
        ("hall_centerpiece", "hall_dining"),
        ("hall_dining", "door_kitchen"),
        ("door_kitchen", "k_cookware"),
        ("k_cookware", "k_hearth"),
        ("k_cookware", "k_spices"),
        ("k_spices", "door_balcony"),

        # Main Hall Spine to Bedroom 2
        ("hall_centerpiece", "hall_tapestry"),
        ("hall_tapestry", "hall_wp_bed2"),
        ("hall_wp_bed2", "door_bed2"),
        ("door_bed2", "b2_canopy"),
        ("b2_canopy", "b2_wardrobe"),
        ("b2_wardrobe", "b2_desk"),

        # Main Hall Spine to Bathroom 1
        ("hall_tapestry", "hall_statue"),
        ("hall_statue", "door_bath1"),
        ("door_bath1", "bath1_tub"),
        ("bath1_tub", "bath1_basin"),

        # Main Hall Spine to Bedroom 1
        ("hall_statue", "hall_chandelier"),
        ("hall_chandelier", "door_bed1"),
        ("door_bed1", "b1_master_bed"),
        ("b1_master_bed", "b1_armoire"),
        ("b1_armoire", "b1_screen"),
        ("b1_screen", "b1_vanity"),

        # Bedroom 1 to Bathroom 2
        ("b1_master_bed", "door_bath2"),
        ("door_bath2", "bath2_washstand"),
    ]

    nodes_by_key = {n["key"]: n for n in nodes_spec}
    print("\n--- EDGES DISTANCE AUDIT ---")
    created_edges_count = 0
    for a_key, b_key in edges_spec:
        na = nodes_by_key[a_key]
        nb = nodes_by_key[b_key]
        ida = node_db_ids[a_key]
        idb = node_db_ids[b_key]

        # Calculate pixel-scaled Euclidean and geodetic haversine distance
        dx = (na["x"] - nb["x"]) * w
        dy = (na["y"] - nb["y"]) * h
        euc_dist = math.hypot(dx, dy) * scale

        lat1, lng1 = map_xy_to_gps(na["x"], na["y"], fp)
        lat2, lng2 = map_xy_to_gps(nb["x"], nb["y"], fp)
        real_dist = round(haversine_distance(lat1, lng1, lat2, lng2), 2)

        edge_type = "door" if ("door" in a_key or "door" in b_key) else "normal"

        execute_query(
            "INSERT INTO map_edges (from_node_id, to_node_id, distance, walkable, edge_type) "
            "VALUES (%s::uuid, %s::uuid, %s, %s, %s)",
            (ida, idb, real_dist, True, edge_type),
            commit=True
        )
        created_edges_count += 1
        print(f"Edge: {na['name']:25s} <--> {nb['name']:25s} | Distance: {real_dist:5.2f}m ({edge_type})")

    print(f"\nSuccessfully created {created_edges_count} edges for floor plan {PLAN_ID}!")

if __name__ == '__main__':
    with app.app_context():
        for pid in PLAN_IDS:
            setup_plan(pid)
