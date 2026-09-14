import math
import uuid
import json
from app import create_app
from app.utils.db import execute_query
from app.utils.geo import haversine_distance
from app.utils.geometry import point_in_polygon, segment_crosses_any_wall

app = create_app()

PLAN_ID = 'e4000000-0000-0000-0000-000000000004'
MUSEUM_ID = 1 # National History Museum
FLOOR_NUM = 2

def setup_4room_plan(plan_id=PLAN_ID):
    print("=================================================================")
    print(f"Setting up 4-Room Floor Plan ({plan_id})...")
    print("=================================================================")

    w = 1024
    h = 768
    scale = 0.15 # meters per pixel (ensures >= 10m between all nodes)

    lat0, lng0 = 13.0722, 77.6550
    m_per_lat_deg = 111320.0
    m_per_lng_deg = 111320.0 * math.cos(math.radians(lat0))

    span_w_m = w * scale # 153.6m
    span_h_m = h * scale # 115.2m

    scale_x = span_w_m / m_per_lng_deg
    scale_y = -span_h_m / m_per_lat_deg

    affine_transform = {
        "type": "similarity",
        "scale_x": scale_x,
        "scale_y": scale_y,
        "offset_x": lng0,
        "offset_y": lat0
    }

    # 1. Insert or update floor_plan
    fp_query = """
        INSERT INTO floor_plans (
            id, museum_id, name, floor_number, image_url, width_px, height_px,
            scale_meters_per_px, is_outdoor, affine_transform,
            anchor_1_x_px, anchor_1_y_px, anchor_1_lat, anchor_1_lng,
            anchor_2_x_px, anchor_2_y_px, anchor_2_lat, anchor_2_lng
        ) VALUES (
            %s::uuid, %s, %s, %s, %s, %s, %s,
            %s, FALSE, %s::jsonb,
            0, 0, %s, %s,
            1024.0, 768.0, %s, %s
        ) ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            floor_number = EXCLUDED.floor_number,
            image_url = EXCLUDED.image_url,
            width_px = EXCLUDED.width_px,
            height_px = EXCLUDED.height_px,
            scale_meters_per_px = EXCLUDED.scale_meters_per_px,
            affine_transform = EXCLUDED.affine_transform,
            anchor_1_lat = EXCLUDED.anchor_1_lat,
            anchor_1_lng = EXCLUDED.anchor_1_lng,
            anchor_2_x_px = EXCLUDED.anchor_2_x_px,
            anchor_2_y_px = EXCLUDED.anchor_2_y_px,
            anchor_2_lat = EXCLUDED.anchor_2_lat,
            anchor_2_lng = EXCLUDED.anchor_2_lng
    """
    execute_query(
        fp_query,
        (
            plan_id, MUSEUM_ID, "Apartment Gallery (4 Rooms)", FLOOR_NUM,
            "/api/static/uploads/apartment_4room_plan.png", w, h,
            scale, json.dumps(affine_transform), lat0, lng0,
            lat0 + scale_y, lng0 + scale_x
        ),
        commit=True
    )
    print("Floor plan registered.")

    # 2. Clean up existing stale data for this floor plan
    execute_query(
        "DELETE FROM map_edges WHERE from_node_id IN (SELECT id FROM map_nodes WHERE floor_plan_id = %s::uuid) "
        "OR to_node_id IN (SELECT id FROM map_nodes WHERE floor_plan_id = %s::uuid)",
        (plan_id, plan_id), commit=True
    )
    execute_query("DELETE FROM map_nodes WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
    execute_query("DELETE FROM artifacts WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
    execute_query(
        "DELETE FROM doorway_openings WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)",
        (plan_id,), commit=True
    )
    execute_query(
        "DELETE FROM room_boundaries WHERE room_id IN (SELECT id FROM rooms WHERE floor_plan_id = %s::uuid)",
        (plan_id,), commit=True
    )
    execute_query("DELETE FROM rooms WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)

    # 3. Create the 4 Rooms
    rooms_data = [
        {
            "name": "Living Room",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.352, 0.323),
                (0.648, 0.323),
                (0.648, 0.493),
                (0.477, 0.493),
                (0.477, 0.789),
                (0.352, 0.789),
            ]
        },
        {
            "name": "Kitchen",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.352, 0.034),
                (0.465, 0.034),
                (0.465, 0.323),
                (0.352, 0.323),
            ]
        },
        {
            "name": "Bedroom",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.465, 0.034),
                (0.648, 0.034),
                (0.648, 0.323),
                (0.465, 0.323),
            ]
        },
        {
            "name": "Bath",
            "type": "gallery",
            "walkable": True,
            "boundaries": [
                (0.477, 0.493),
                (0.591, 0.493),
                (0.591, 0.789),
                (0.477, 0.789),
            ]
        }
    ]

    room_ids: dict[str, str] = {}
    for r in rooms_data:
        r_row = execute_query(
            "INSERT INTO rooms (floor_plan_id, name, room_type, walkable) VALUES (%s::uuid, %s, %s, %s) RETURNING id",
            (plan_id, r["name"], r["type"], r["walkable"]),
            fetchone=True,
            commit=True
        )
        rid = str(r_row[0])
        room_ids[str(r["name"])] = rid

        for order, (bx, by) in enumerate(r["boundaries"]):
            blat = lat0 + by * scale_y
            blng = lng0 + bx * scale_x
            execute_query(
                "INSERT INTO room_boundaries (room_id, corner_order, x, y, latitude, longitude) "
                "VALUES (%s::uuid, %s, %s, %s, %s, %s)",
                (rid, order, bx, by, blat, blng),
                commit=True
            )

    print(f"Created 4 rooms: {list(room_ids.keys())}")

    # 4. Create Doorway Openings (All 3 outer rooms connect ONLY to Living Room, plus Main Entrance)
    doorways_data = [
        {
            "name": "Main Entrance Door",
            "room": "Living Room",
            "connected_room": None,
            "x1": 0.365, "y1": 0.789, "x2": 0.425, "y2": 0.789
        },
        {
            "name": "Kitchen Doorway",
            "room": "Kitchen",
            "connected_room": "Living Room",
            "x1": 0.400, "y1": 0.323, "x2": 0.455, "y2": 0.323
        },
        {
            "name": "Bedroom Doorway",
            "room": "Bedroom",
            "connected_room": "Living Room",
            "x1": 0.475, "y1": 0.323, "x2": 0.535, "y2": 0.323
        },
        {
            "name": "Bath Doorway",
            "room": "Bath",
            "connected_room": "Living Room",
            "x1": 0.500, "y1": 0.493, "x2": 0.560, "y2": 0.493
        }
    ]

    for d in doorways_data:
        rid = room_ids[str(d["room"])]
        conn_room = str(d["connected_room"]) if d["connected_room"] else None
        c_rid = room_ids[conn_room] if conn_room else None
        execute_query(
            "INSERT INTO doorway_openings (room_id, x1, y1, x2, y2, connected_room_id, name) "
            "VALUES (%s::uuid, %s, %s, %s, %s, %s::uuid, %s)",
            (rid, d["x1"], d["y1"], d["x2"], d["y2"], c_rid, d["name"]),
            commit=True
        )

    print(f"Created {len(doorways_data)} doorway openings.")

    # 5. Define 4 Exhibit Objects (Exactly 1 per room)
    exhibits_data = [
        {
            "key": "living_chandelier",
            "title": "Royal Crystal Chandelier",
            "room": "Living Room",
            "x": 0.590, "y": 0.420,
            "desc": "Prismatic Bohemian cut crystal chandelier with gilded brass armature.",
            "type": "exhibit"
        },
        {
            "key": "kitchen_urn",
            "title": "Antique Bronze Culinary Urn",
            "room": "Kitchen",
            "x": 0.410, "y": 0.160,
            "desc": "Hand-forged Hellenistic bronze cauldron used for banquet preparations.",
            "type": "exhibit"
        },
        {
            "key": "bedroom_canopy",
            "title": "Imperial Silk Canopy Bed",
            "room": "Bedroom",
            "x": 0.560, "y": 0.150,
            "desc": "Ornate four-poster mahogany bed adorned with hand-embroidered royal silk drapes.",
            "type": "exhibit"
        },
        {
            "key": "bath_basin",
            "title": "Classical Marble Ritual Basin",
            "room": "Bath",
            "x": 0.530, "y": 0.680,
            "desc": "Sculpted Carrara marble ablution vessel featuring dolphin relief carvings.",
            "type": "exhibit"
        }
    ]

    # Waypoints, Doorways, and Entrance nodes
    waypoints_data = [
        {
            "key": "entrance_main",
            "title": "Main Entrance",
            "room": "Living Room",
            "x": 0.395, "y": 0.760,
            "desc": "Main entrance threshold to the apartment gallery.",
            "type": "entrance,exit"
        },
        {
            "key": "living_foyer",
            "title": "Living Room Foyer",
            "room": "Living Room",
            "x": 0.395, "y": 0.620,
            "desc": "Transition gallery connecting the entrance corridor to the main living hall.",
            "type": "hallway,waypoint"
        },
        {
            "key": "living_center",
            "title": "Living Room Central Hub",
            "room": "Living Room",
            "x": 0.450, "y": 0.460,
            "desc": "Central navigation hub linking all four rooms and exhibitions.",
            "type": "junction"
        },
        {
            "key": "door_kitchen",
            "title": "Kitchen Doorway",
            "room": "Kitchen",
            "x": 0.430, "y": 0.323,
            "desc": "Threshold connecting the Living Room and Kitchen.",
            "type": "doorway"
        },
        {
            "key": "door_bedroom",
            "title": "Bedroom Doorway",
            "room": "Bedroom",
            "x": 0.510, "y": 0.323,
            "desc": "Door opening connecting the Living Room and Bedroom.",
            "type": "doorway"
        },
        {
            "key": "door_bath",
            "title": "Bath Doorway",
            "room": "Bath",
            "x": 0.530, "y": 0.493,
            "desc": "Doorway connecting the Living Room and Bath.",
            "type": "doorway"
        }
    ]

    node_db_ids = {}

    # Insert exhibits (objects + artifacts + map_nodes)
    for ex in exhibits_data:
        ex_x, ex_y = float(ex["x"]), float(ex["y"])
        lat = lat0 + ex_y * scale_y
        lng = lng0 + ex_x * scale_x

        # 1. Insert into objects table
        obj_row = execute_query(
            "INSERT INTO objects (museum_id, name, description, latitude, longitude, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, NOW(), NOW()) RETURNING id",
            (MUSEUM_ID, ex["title"], ex["desc"], lat, lng),
            fetchone=True, commit=True
        )
        obj_id = obj_row[0]

        # 2. Insert into artifacts table
        art_row = execute_query(
            "INSERT INTO artifacts (floor_plan_id, name, description, map_x, map_y, latitude, longitude) "
            "VALUES (%s::uuid, %s, %s, %s, %s, %s, %s) RETURNING id",
            (plan_id, ex["title"], ex["desc"], ex["x"], ex["y"], lat, lng),
            fetchone=True, commit=True
        )
        art_id = str(art_row[0])

        # 3. Insert into map_nodes table
        node_row = execute_query(
            "INSERT INTO map_nodes (name, floor, x_coordinate, y_coordinate, node_type, floor_plan_id, latitude, longitude, artifact_id, object_id, is_must_visit) "
            "VALUES (%s, %s, %s, %s, %s, %s::uuid, %s, %s, %s::uuid, %s, TRUE) RETURNING id",
            (ex["title"], FLOOR_NUM, ex["x"], ex["y"], ex["type"], plan_id, lat, lng, art_id, obj_id),
            fetchone=True, commit=True
        )
        node_db_ids[ex["key"]] = str(node_row[0])
        print(f"Created Exhibit: {ex['title']} in {ex['room']} (node_id={node_row[0]})")

    # Insert waypoints and doorways
    for wp in waypoints_data:
        wp_x, wp_y = float(wp["x"]), float(wp["y"])
        lat = lat0 + wp_y * scale_y
        lng = lng0 + wp_x * scale_x

        node_row = execute_query(
            "INSERT INTO map_nodes (name, floor, x_coordinate, y_coordinate, node_type, floor_plan_id, latitude, longitude) "
            "VALUES (%s, %s, %s, %s, %s, %s::uuid, %s, %s) RETURNING id",
            (wp["title"], FLOOR_NUM, wp["x"], wp["y"], wp["type"], plan_id, lat, lng),
            fetchone=True, commit=True
        )
        node_db_ids[wp["key"]] = str(node_row[0])
        print(f"Created Waypoint/Doorway: {wp['title']} (node_id={node_row[0]})")

    # 6. Define Edges (strictly through doorways; Living Room is the central spine)
    all_nodes_dict = {**{e["key"]: e for e in exhibits_data}, **{w["key"]: w for w in waypoints_data}}

    edges_spec = [
        # Main Entrance spine into Living Room
        ("entrance_main", "living_foyer"),
        ("living_foyer", "living_center"),

        # Living Room Center to Living Room Exhibit
        ("living_center", "living_chandelier"),

        # Living Room Center to Kitchen Doorway -> Kitchen Urn
        ("living_center", "door_kitchen"),
        ("door_kitchen", "kitchen_urn"),

        # Living Room Center to Bedroom Doorway -> Bedroom Canopy
        ("living_center", "door_bedroom"),
        ("door_bedroom", "bedroom_canopy"),

        # Living Room Center to Bath Doorway -> Bath Basin
        ("living_center", "door_bath"),
        ("door_bath", "bath_basin"),
    ]

    print("\n=======================================================")
    print("Edge Distance & Wall Crossing Verification (Threshold: >= 10.0m)")
    print("=======================================================")

    all_rooms_db = [
        {"name": r["name"], "walkable": r["walkable"], "boundaries": [{"x": p[0], "y": p[1]} for p in r["boundaries"]]}
        for r in rooms_data
    ]

    created_edges = 0
    for a_key, b_key in edges_spec:
        na = all_nodes_dict[a_key]
        nb = all_nodes_dict[b_key]
        ida = node_db_ids[a_key]
        idb = node_db_ids[b_key]

        # Calculate Euclidean distance on scaled floor plan
        ax, ay = float(na["x"]), float(na["y"])
        bx, by = float(nb["x"]), float(nb["y"])

        dx = (ax - bx) * w
        dy = (ay - by) * h
        euc_dist = math.hypot(dx, dy) * scale

        # Calculate GPS haversine distance
        lat1 = lat0 + ay * scale_y
        lng1 = lng0 + ax * scale_x
        lat2 = lat0 + by * scale_y
        lng2 = lng0 + bx * scale_x
        real_dist = round(haversine_distance(lat1, lng1, lat2, lng2), 2)

        # Check wall crossing
        crosses = segment_crosses_any_wall(ax, ay, bx, by, all_rooms_db, doorways_data, door_tolerance=0.08)

        edge_type = "door" if ("door" in a_key or "door" in b_key) else "normal"

        assert real_dist >= 10.0, f"Distance violation! Edge {a_key} <-> {b_key} distance is {real_dist}m (< 10.0m)"
        assert not crosses, f"Illegal wall crossing on edge {a_key} <-> {b_key}!"

        # Insert bidirectional edge
        execute_query(
            "INSERT INTO map_edges (from_node_id, to_node_id, distance, walkable, edge_type) "
            "VALUES (%s::uuid, %s::uuid, %s, TRUE, %s)",
            (ida, idb, real_dist, edge_type), commit=True
        )
        execute_query(
            "INSERT INTO map_edges (from_node_id, to_node_id, distance, walkable, edge_type) "
            "VALUES (%s::uuid, %s::uuid, %s, TRUE, %s)",
            (idb, ida, real_dist, edge_type), commit=True
        )
        created_edges += 2
        print(f"✓ Edge: {na['title']:30s} <--> {nb['title']:30s} | Dist: {real_dist:5.2f}m | Walls Clear: YES")

    # 7. Register Unique QR Codes (Museum Entrance, Room Doorways, and Exhibits)
    print("\n=======================================================")
    print("Registering Unique QR Codes for Museum & Rooms...")
    print("=======================================================")
    qr_entries = [
        # Whole Museum Entrance QR Codes
        ("entrance_main", f"vanalok://museum/{MUSEUM_ID}"),
        ("entrance_main", f"vanalok_museum_{MUSEUM_ID}_entrance"),
        ("entrance_main", f"https://vanalok.app/m/{MUSEUM_ID}"),

        # Unique Room / Gallery Doorway Entry QR Codes
        ("living_foyer", f"vanalok://museum/{MUSEUM_ID}/room/living_room"),
        ("living_foyer", "room_living_room_entrance"),
        ("door_kitchen", f"vanalok://museum/{MUSEUM_ID}/room/kitchen"),
        ("door_kitchen", "room_kitchen_entrance"),
        ("door_bedroom", f"vanalok://museum/{MUSEUM_ID}/room/bedroom"),
        ("door_bedroom", "room_bedroom_entrance"),
        ("door_bath", f"vanalok://museum/{MUSEUM_ID}/room/bath"),
        ("door_bath", "room_bath_entrance"),

        # Individual Exhibit QR Codes
        ("living_chandelier", "vanalok://object/living_chandelier"),
        ("kitchen_urn", "vanalok://object/kitchen_urn"),
        ("bedroom_canopy", "vanalok://object/bedroom_canopy"),
        ("bath_basin", "vanalok://object/bath_basin"),
    ]

    for node_key, payload in qr_entries:
        target_node_id = node_db_ids.get(node_key)
        if target_node_id:
            execute_query("""
                INSERT INTO qr_locations (floor_plan_id, node_id, qr_payload)
                VALUES (%s::uuid, %s::uuid, %s)
                ON CONFLICT (qr_payload) DO UPDATE
                SET floor_plan_id = EXCLUDED.floor_plan_id, node_id = EXCLUDED.node_id
            """, (plan_id, target_node_id, payload), commit=True)
            print(f"✓ QR: '{payload}' -> Node '{node_key}' ({target_node_id})")

    print(f"\nSuccessfully set up 4-room floor plan {plan_id} with {created_edges} directed edges and {len(qr_entries)} QR codes.")

if __name__ == '__main__':
    with app.app_context():
        setup_4room_plan()
