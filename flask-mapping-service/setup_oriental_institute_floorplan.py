import math
import uuid
import json
from app import create_app
from app.utils.db import execute_query
from app.utils.geo import haversine_distance
from app.utils.geometry import point_in_polygon, segment_crosses_any_wall

app = create_app()

PLAN_ID = 'f1000000-0000-0000-0000-000000000001'
MUSEUM_ID = 1  # Oriental Institute Museum / Primary Museum
FLOOR_NUM = 1

def setup_oriental_institute_plan(plan_id=PLAN_ID, wipe_all_old_plans=True):
    print("=================================================================")
    print(f"Setting up Oriental Institute Museum Floor Plan ({plan_id})...")
    print("=================================================================")

    w = 832
    h = 1024
    scale = 0.08  # meters per pixel (~66.5m x 81.9m)

    lat0, lng0 = 13.0722, 80.2550
    m_per_lat_deg = 111320.0
    m_per_lng_deg = 111320.0 * math.cos(math.radians(lat0))

    span_w_m = w * scale  # 66.56m
    span_h_m = h * scale  # 81.92m

    scale_x = span_w_m / m_per_lng_deg
    scale_y = -span_h_m / m_per_lat_deg

    affine_transform = {
        "type": "similarity",
        "scale_x": scale_x,
        "scale_y": scale_y,
        "offset_x": lng0,
        "offset_y": lat0
    }

    # 1. Clean up old floor plans & artifacts across the database if requested
    if wipe_all_old_plans:
        print("Wiping all existing floor plans, rooms, edges, nodes, and artifacts...")
        execute_query("DELETE FROM qr_locations;", commit=True)
        execute_query("DELETE FROM map_edges;", commit=True)
        execute_query("DELETE FROM wifi_fingerprints;", commit=True)
        execute_query("DELETE FROM doorway_openings;", commit=True)
        execute_query("DELETE FROM room_boundaries;", commit=True)
        execute_query("DELETE FROM map_nodes;", commit=True)
        execute_query("DELETE FROM artifacts;", commit=True)
        execute_query("DELETE FROM rooms;", commit=True)
        execute_query("DELETE FROM map_anchors;", commit=True)
        execute_query("DELETE FROM floor_plan_footprints;", commit=True)
        execute_query("DELETE FROM floor_plans WHERE id != %s::uuid;", (plan_id,), commit=True)
        print("Old floor plans and artifacts wiped successfully.")

    # 2. Register or update Museum 1 information
    execute_query("""
        UPDATE museums
        SET name = 'Oriental Institute Museum',
            location = 'Chicago, IL, USA / Virtual Wing',
            description = 'World-renowned museum and research center for the ancient Middle East, Egypt, Mesopotamia, Assyria, Anatolia, Nubia, and Persia.',
            latitude = %s,
            longitude = %s,
            floorplan_image = '/api/static/uploads/oriental_institute_floorplan.png?v=20260916'
        WHERE id = %s;
    """, (lat0, lng0, MUSEUM_ID), commit=True)

    # 3. Register the new Floor Plan
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
            832.0, 1024.0, %s, %s
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
            plan_id, MUSEUM_ID, "Oriental Institute Museum - Main Floor", FLOOR_NUM,
            "/api/static/uploads/oriental_institute_floorplan.png?v=20260916", w, h,
            scale, json.dumps(affine_transform), lat0, lng0,
            lat0 + scale_y, lng0 + scale_x
        ),
        commit=True
    )
    print("Oriental Institute Floor plan registered.")

    # 4. Clean up any leftover for this plan_id
    execute_query("DELETE FROM qr_locations WHERE floor_plan_id = %s::uuid", (plan_id,), commit=True)
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

    # 5. Define the 15 Gallery Rooms matching the realistic floor plan
    rooms_data = [
        {
            "name": "Lobby",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.070, 0.720), (0.280, 0.720), (0.280, 0.890), (0.070, 0.890)]
        },
        {
            "name": "Museum Store",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.070, 0.640), (0.280, 0.640), (0.280, 0.720), (0.070, 0.720)]
        },
        {
            "name": "Visitor Orientation",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.070, 0.540), (0.280, 0.540), (0.280, 0.640), (0.070, 0.640)]
        },
        {
            "name": "Prehistory",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.070, 0.420), (0.280, 0.420), (0.280, 0.540), (0.070, 0.540)]
        },
        {
            "name": "Mesopotamia",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.070, 0.170), (0.280, 0.170), (0.280, 0.420), (0.070, 0.420)]
        },
        {
            "name": "Khorsabad Court",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.070, 0.030), (0.280, 0.030), (0.280, 0.170), (0.070, 0.170)]
        },
        {
            "name": "Assyria",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.280, 0.110), (0.460, 0.110), (0.460, 0.270), (0.280, 0.270)]
        },
        {
            "name": "Syria & Anatolia",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.460, 0.100), (0.720, 0.100), (0.720, 0.270), (0.460, 0.270)]
        },
        {
            "name": "Megiddo",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.720, 0.100), (0.910, 0.100), (0.910, 0.270), (0.720, 0.270)]
        },
        {
            "name": "Courtyard",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.280, 0.270), (0.680, 0.270), (0.680, 0.585), (0.280, 0.585)]
        },
        {
            "name": "Egypt",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.680, 0.270), (0.910, 0.270), (0.910, 0.680), (0.680, 0.680)]
        },
        {
            "name": "Nubia",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.480, 0.585), (0.680, 0.585), (0.680, 0.685), (0.480, 0.685)]
        },
        {
            "name": "Temporary Exhibits",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.280, 0.585), (0.480, 0.585), (0.480, 0.685), (0.280, 0.685)]
        },
        {
            "name": "Breasted Lecture Hall",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.280, 0.685), (0.680, 0.685), (0.680, 0.880), (0.280, 0.880)]
        },
        {
            "name": "Persia",
            "type": "gallery",
            "walkable": True,
            "boundaries": [(0.680, 0.680), (0.930, 0.680), (0.930, 0.880), (0.680, 0.880)]
        }
    ]

    room_ids = {}
    for r in rooms_data:
        r_row = execute_query(
            "INSERT INTO rooms (floor_plan_id, name, room_type, walkable) VALUES (%s::uuid, %s, %s, %s) RETURNING id",
            (plan_id, r["name"], r["type"], r["walkable"]),
            fetchone=True, commit=True
        )
        rid = str(r_row[0])
        room_ids[r["name"]] = rid

        for order, (bx, by) in enumerate(r["boundaries"]):
            blat = lat0 + by * scale_y
            blng = lng0 + bx * scale_x
            execute_query(
                "INSERT INTO room_boundaries (room_id, corner_order, x, y, latitude, longitude) "
                "VALUES (%s::uuid, %s, %s, %s, %s, %s)",
                (rid, order, bx, by, blat, blng),
                commit=True
            )

    print(f"Created {len(room_ids)} gallery rooms in rooms table.")

    # 6. Synchronize galleries in the galleries table for Museum 1
    execute_query("UPDATE objects SET gallery_id = NULL WHERE museum_id = %s;", (MUSEUM_ID,), commit=True)
    execute_query("DELETE FROM galleries WHERE museum_id = %s;", (MUSEUM_ID,), commit=True)
    gallery_db_ids = {}
    for r in rooms_data:
        g_row = execute_query(
            "INSERT INTO galleries (museum_id, name, description, floor) VALUES (%s, %s, %s, %s) RETURNING id",
            (MUSEUM_ID, r["name"], f"The {r['name']} exhibition gallery at the Oriental Institute Museum.", str(FLOOR_NUM)),
            fetchone=True, commit=True
        )
        gallery_db_ids[r["name"]] = g_row[0]
    print("Galleries table synchronized with all 15 rooms.")

    # 7. Define Doorway Openings between Rooms
    doorways_data = [
        {"name": "Main Entrance Door", "room": "Lobby", "connected_room": None, "x1": 0.050, "y1": 0.770, "x2": 0.080, "y2": 0.820},
        {"name": "Lobby to Store Doorway", "room": "Lobby", "connected_room": "Museum Store", "x1": 0.150, "y1": 0.720, "x2": 0.230, "y2": 0.720},
        {"name": "Store to Orientation Doorway", "room": "Museum Store", "connected_room": "Visitor Orientation", "x1": 0.150, "y1": 0.640, "x2": 0.230, "y2": 0.640},
        {"name": "Orientation to Prehistory Doorway", "room": "Visitor Orientation", "connected_room": "Prehistory", "x1": 0.150, "y1": 0.540, "x2": 0.230, "y2": 0.540},
        {"name": "Prehistory to Mesopotamia Doorway", "room": "Prehistory", "connected_room": "Mesopotamia", "x1": 0.150, "y1": 0.420, "x2": 0.230, "y2": 0.420},
        {"name": "Mesopotamia to Khorsabad Doorway", "room": "Mesopotamia", "connected_room": "Khorsabad Court", "x1": 0.150, "y1": 0.170, "x2": 0.230, "y2": 0.170},
        {"name": "Khorsabad to Assyria Doorway", "room": "Khorsabad Court", "connected_room": "Assyria", "x1": 0.280, "y1": 0.140, "x2": 0.280, "y2": 0.220},
        {"name": "Assyria to Syria Doorway", "room": "Assyria", "connected_room": "Syria & Anatolia", "x1": 0.460, "y1": 0.140, "x2": 0.460, "y2": 0.220},
        {"name": "Syria to Megiddo Doorway", "room": "Syria & Anatolia", "connected_room": "Megiddo", "x1": 0.720, "y1": 0.140, "x2": 0.720, "y2": 0.220},
        {"name": "Megiddo to Egypt Doorway", "room": "Megiddo", "connected_room": "Egypt", "x1": 0.750, "y1": 0.270, "x2": 0.850, "y2": 0.270},
        {"name": "Egypt to Nubia Doorway", "room": "Egypt", "connected_room": "Nubia", "x1": 0.680, "y1": 0.600, "x2": 0.680, "y2": 0.670},
        {"name": "Egypt to Persia Doorway", "room": "Egypt", "connected_room": "Persia", "x1": 0.750, "y1": 0.680, "x2": 0.850, "y2": 0.680},
        {"name": "Nubia to Temporary Exhibits Doorway", "room": "Nubia", "connected_room": "Temporary Exhibits", "x1": 0.480, "y1": 0.600, "x2": 0.480, "y2": 0.670},
        {"name": "Temp Exhibits to West Corridor Doorway", "room": "Temporary Exhibits", "connected_room": "Visitor Orientation", "x1": 0.280, "y1": 0.580, "x2": 0.280, "y2": 0.660},
        {"name": "Lobby to Breasted Hall Doorway", "room": "Lobby", "connected_room": "Breasted Lecture Hall", "x1": 0.280, "y1": 0.740, "x2": 0.280, "y2": 0.810},
        {"name": "Courtyard North Doorway", "room": "Courtyard", "connected_room": "Syria & Anatolia", "x1": 0.460, "y1": 0.270, "x2": 0.550, "y2": 0.270},
        {"name": "Courtyard South Doorway", "room": "Courtyard", "connected_room": "Temporary Exhibits", "x1": 0.350, "y1": 0.585, "x2": 0.450, "y2": 0.585}
    ]

    for d in doorways_data:
        rid = room_ids[d["room"]]
        conn_room = d["connected_room"]
        c_rid = room_ids[conn_room] if conn_room else None
        execute_query(
            "INSERT INTO doorway_openings (room_id, x1, y1, x2, y2, connected_room_id, name) "
            "VALUES (%s::uuid, %s, %s, %s, %s, %s::uuid, %s)",
            (rid, d["x1"], d["y1"], d["x2"], d["y2"], c_rid, d["name"]),
            commit=True
        )
    print(f"Created {len(doorways_data)} doorway openings.")

    # 8. Define Authentic Exhibits & Artifacts placed exactly on the architectural pedestals
    exhibits_data = [
        {
            "key": "exhibit_info_kiosk",
            "title": "Oriental Institute Information & Interactive Audio Kiosk",
            "room": "Lobby",
            "x": 0.190, "y": 0.850,
            "desc": "Interactive orientation terminal providing digital high-resolution floor plans, multi-language audio tour paths, and curatorial introductions for the Institute for the Study of Ancient Cultures.",
            "period": "Modern Digital Guide",
            "origin": "Chicago, IL, USA",
            "category": "Information & Services",
            "significance": "Central orientation hub welcoming visitors and providing personalized accessibility guidance.",
            "facts": ["Interactive touch terminal with museum tour paths", "Offers 8 language audio guides", "Digital high-res catalog of the entire collection"]
        },
        {
            "key": "exhibit_suq_store",
            "title": "The Suq Museum Bookstore & Curios",
            "room": "Museum Store",
            "x": 0.170, "y": 0.675,
            "desc": "The authentic Oriental Institute museum store featuring scholarly excavation publications, papyrus prints, hand-crafted jewelry, and certified museum replica antiquities.",
            "period": "Contemporary Collections",
            "origin": "University of Chicago",
            "category": "Museum Store & Publications",
            "significance": "Named after the historic Arabic marketplace ('Suq'), supporting ongoing research and international field excavations.",
            "facts": ["Founded in 1931 alongside the museum building", "Features authentic replicas and scholarly excavation publications", "Offers hand-crafted Middle Eastern jewelry and ceramics"]
        },
        {
            "key": "exhibit_breasted_timeline",
            "title": "James Henry Breasted Chronology Mural",
            "room": "Visitor Orientation",
            "x": 0.195, "y": 0.570,
            "desc": "Monumental illustrated historical timeline depicting the rise of civilizations across the Fertile Crescent and the Nile Valley from 10,000 BCE through antiquity.",
            "period": "10,000 BCE – 1000 CE",
            "origin": "Ancient Near East & Nile Valley",
            "category": "Historical Mural",
            "significance": "Chronicles archaeological discoveries spearheaded by James Henry Breasted, who popularized the concept of the Fertile Crescent.",
            "facts": ["Traces the birth of agriculture, cities, and writing", "Coined the historical term 'Fertile Crescent'", "Illustrates synchronisms between Egyptian and Mesopotamian dynasties"]
        },
        {
            "key": "exhibit_jarmo_goddess",
            "title": "Jarmo Clay Mother Goddess Figurine",
            "room": "Prehistory",
            "x": 0.195, "y": 0.450,
            "desc": "One of humanity's earliest known ceramic representations of the female form (~7000 BCE), discovered at the seminal Neolithic agricultural village of Jarmo in Iraqi Kurdistan.",
            "period": "Neolithic (~7000 BCE)",
            "origin": "Jarmo, Zagros Foothills, Iraqi Kurdistan",
            "category": "Neolithic Antiquities",
            "significance": "Pioneering evidence of the transition from nomadic foraging to sedentary village life and fertility rituals.",
            "facts": ["One of humanity's earliest sculptural depictions of the human form", "Excavated by Robert Braidwood in the 1940s and 50s", "Associated with early agricultural fertility rituals"]
        },
        {
            "key": "exhibit_hassuna_pottery",
            "title": "Hassuna Painted Ceramic Storage Jar",
            "room": "Prehistory",
            "x": 0.195, "y": 0.505,
            "desc": "Finely crafted Neolithic painted pottery vessel (~6000 BCE) featuring intricate geometric slip decorations and incised chevron patterns.",
            "period": "Hassuna Period (~6000 BCE)",
            "origin": "Tell Hassuna, Nineveh Governorate, Iraq",
            "category": "Ancient Ceramics",
            "significance": "Demonstrates the earliest master kilning and decorative ceramics in Upper Mesopotamia.",
            "facts": ["Showcases earliest sophisticated kilning and geometric slip painting", "Discovered in subterranean storage grain silos", "Precursor to Halafian fine luxury pottery"]
        },
        {
            "key": "exhibit_sumerian_worshiper",
            "title": "Statue of a Sumerian Worshiper from Tell Asmar",
            "room": "Mesopotamia",
            "x": 0.195, "y": 0.245,
            "desc": "World-famous Early Dynastic gypsum alabaster statue (~2900-2600 BCE) with wide, inlaid shell and black limestone eyes, clasped praying hands, and tiered kaunakes fleece skirt.",
            "period": "Early Dynastic I–II (~2900–2600 BCE)",
            "origin": "Square Temple of Abu, Tell Asmar (ancient Eshnunna), Iraq",
            "category": "Sumerian Statuary",
            "significance": "Placed in shrines as an eternal stand-in for elite Sumerians to offer perpetual prayer to the god Abu.",
            "facts": ["Inlaid eyes of lapis lazuli, shell, and black limestone gazing in perpetual devotion", "Clasped hands hold an offering cup before the god Abu", "Excavated by the Oriental Institute Iraq Expedition in 1933–34"]
        },
        {
            "key": "exhibit_babylonian_lion",
            "title": "Babylonian Striding Lion Glazed Brick Relief",
            "room": "Mesopotamia",
            "x": 0.195, "y": 0.315,
            "desc": "Magnificent polychrome glazed ceramic brick panel depicting the golden sacred lion of Ishtar from Nebuchadnezzar II's Processional Way in Babylon (~604-562 BCE).",
            "period": "Neo-Babylonian Empire (Reign of Nebuchadnezzar II, c. 604–562 BCE)",
            "origin": "Processional Way & Ishtar Gate, Babylon, Iraq",
            "category": "Architectural Relief",
            "significance": "Represented royal invincibility and divine protection along the ceremonial avenue leading into the city of Babylon.",
            "facts": ["Symbolizes Ishtar, the Babylonian goddess of love and warfare", "Molded and glazed with vibrant lapis-blue and golden-yellow glazes", "Mounted along the sacred avenue to the temple of Marduk"]
        },
        {
            "key": "exhibit_gilgamesh_tablet",
            "title": "Epic of Gilgamesh Cuneiform Tablet Fragment",
            "room": "Mesopotamia",
            "x": 0.195, "y": 0.375,
            "desc": "Baked river-clay tablet fragment inscribed in Old Babylonian cuneiform script recounting the heroic adventures of King Gilgamesh of Uruk and the wild man Enkidu.",
            "period": "Old Babylonian Period (~1800–1600 BCE)",
            "origin": "Sippar, Lower Mesopotamia, Iraq",
            "category": "Cuneiform Literature",
            "significance": "The world's earliest literary epic exploring themes of friendship, mortality, and the search for eternal life.",
            "facts": ["Contains lines from Tablet II describing the taming of Enkidu", "Inscribed in fine wedge-shaped Akkadian cuneiform on river clay", "World's oldest surviving epic literary masterpiece"]
        },
        {
            "key": "exhibit_khorsabad_lamassu",
            "title": "Colossal Winged Bull (Lamassu) of King Sargon II",
            "room": "Khorsabad Court",
            "x": 0.190, "y": 0.075,
            "desc": "Monumental 40-ton carved monolith (~721-705 BCE) with the body of a winged bull, five legs to show movement and stillness, and the crowned head of King Sargon II from Khorsabad.",
            "period": "Neo-Assyrian Empire (c. 721–705 BCE)",
            "origin": "Palace of Sargon II, Khorsabad (Dur-Sharrukin), Iraq",
            "category": "Monumental Sculpture",
            "significance": "Guarded the entrance to the royal throne room, terrifying foreign ambassadors with imperial majesty.",
            "facts": ["Carved from a single 40-ton block of crystalline gypsum alabaster", "Possesses five legs so it appears standing firm from the front and walking from the side", "Guarded the entrance to the royal palace throne room"]
        },
        {
            "key": "exhibit_sargon_relief",
            "title": "Palace Bas-Relief of Sargon II and Dignitaries",
            "room": "Khorsabad Court",
            "x": 0.190, "y": 0.135,
            "desc": "Carved gypsum orthostat panel depicting King Sargon II receiving high court officials, grand viziers, and tribute bearers bearing offerings.",
            "period": "Neo-Assyrian Empire (c. 710 BCE)",
            "origin": "Khorsabad (Dur-Sharrukin), Iraq",
            "category": "Palace Relief",
            "significance": "Shows the elaborate ceremonial robes, rosette wristlets, and curled beards characteristic of the Assyrian royal court.",
            "facts": ["Depicts King Sargon II facing his grand vizier and court eunuchs", "Traces of original red and black pigments preserved in the beard and headdress", "Transported by raft down the Tigris River during 1929 excavation"]
        },
        {
            "key": "exhibit_ashurnasirpal_stele",
            "title": "Banquet Stele of King Ashurnasirpal II",
            "room": "Assyria",
            "x": 0.400, "y": 0.200,
            "desc": "Royal sandstone stele (~879 BCE) commemorating the magnificent dedication banquet of the Northwest Palace at Kalhu (Nimrud), recording 69,574 guests served over ten days.",
            "period": "Neo-Assyrian Empire (c. 879 BCE)",
            "origin": "Northwest Palace, Nimrud (ancient Kalhu), Iraq",
            "category": "Royal Inscriptions",
            "significance": "Unrivaled primary document detailing the diplomatic scope, agricultural wealth, and botanical gardens of ancient Assyria.",
            "facts": ["Records the grandest feast of antiquity with 69,574 guests over ten days", "Lists vast menus including 10,000 sheep, 500 deer, and 10,000 skins of wine", "Crowns Ashurnasirpal under the divine emblems of Ashur, Shamash, and Ishtar"]
        },
        {
            "key": "exhibit_tayinat_column",
            "title": "Tell Tayinat Column Base with Twin Lions",
            "room": "Syria & Anatolia",
            "x": 0.550, "y": 0.190,
            "desc": "Neo-Hittite monumental carved basalt column base (~800 BCE) featuring two ferocious crouching guardian lions, excavated by the Oriental Institute in Turkey.",
            "period": "Neo-Hittite / Syro-Hittite (c. 850–750 BCE)",
            "origin": "Kunulua, Tell Tayinat, Amuq Valley, Turkey",
            "category": "Basalt Sculpture",
            "significance": "Supported massive cedar columns at the royal palace gateway (bit-hilani architecture).",
            "facts": ["Carved from dense dark volcanic basalt with bared fangs", "Supported monumental cedar wooden portico columns in the royal palace", "Excavated by the Oriental Institute Syrian-Hittite Expedition"]
        },
        {
            "key": "exhibit_syrian_bronzes",
            "title": "Judeideh Bronze Statuettes of Gods and Warriors",
            "room": "Syria & Anatolia",
            "x": 0.660, "y": 0.190,
            "desc": "Earliest known cast-bronze human figurines discovered in the Near East (~3000-2500 BCE), showcasing a warrior deity with conical silver-plated helmet and spear.",
            "period": "Early Bronze Age (~3000–2500 BCE)",
            "origin": "Tell al-Judeideh, Amuq Valley, Syria/Turkey border",
            "category": "Bronze Metallurgy",
            "significance": "Heralded the revolutionary dawn of the Bronze Age in the Levant.",
            "facts": ["Oldest known cast-bronze human figurines discovered in the Near East", "Male warrior figure wears a conical silver helmet and holds a spear", "Highlights earliest transition from copper to true tin-bronze metallurgy"]
        },
        {
            "key": "exhibit_megiddo_ivories",
            "title": "The Megiddo Ivories: Royal Treasury Plaque",
            "room": "Megiddo",
            "x": 0.810, "y": 0.190,
            "desc": "Finely carved hippopotamus ivory panel (~1200 BCE) discovered in the royal palace treasury at Megiddo (Tel Megiddo), depicting a seated Canaanite prince receiving captive prisoners.",
            "period": "Late Bronze Age II (~1350–1200 BCE)",
            "origin": "Royal Palace Stratum VIIA, Megiddo, Israel",
            "category": "Ivory Carving",
            "significance": "Extraordinary masterpiece blending Canaanite, Egyptian, Mycenaean, and Hittite artistic traditions.",
            "facts": ["Intricately carved hippopotamus ivory plaque showing a Canaanite prince", "Demonstrates Egyptian, Aegean, and Mesopotamian artistic synthesis", "Discovered in a subterranean palace cache of over 380 ivory luxury items"]
        },
        {
            "key": "exhibit_courtyard_fountain",
            "title": "Central Octagonal Limestone Fountain Basin",
            "room": "Courtyard",
            "x": 0.505, "y": 0.420,
            "desc": "Open-air landscaped cloister featuring an octagonal stone reflecting pool, surrounded by monastic-style arched loggias, stone pavers, and fragrant Mediterranean trees.",
            "period": "Classical Cloister Architecture (1931)",
            "origin": "Oriental Institute Courtyard Garden",
            "category": "Architectural Feature",
            "significance": "The peaceful heart of the museum connecting the east and west wings with natural light.",
            "facts": ["Open-air garden designed in Mediterranean cloister style", "Surrounded by limestone loggias inspired by Near Eastern monasteries", "Provides tranquil ambient natural lighting for all surrounding galleries"]
        },
        {
            "key": "exhibit_king_tut",
            "title": "Colossal 17-Foot Statue of King Tutankhamun",
            "room": "Egypt",
            "x": 0.800, "y": 0.335,
            "desc": "Magnificent quartzite statue (~1330 BCE) of the boy Pharaoh Tutankhamun wearing the double crown of Upper and Lower Egypt and royal nemes headdress, excavated from Medinet Habu.",
            "period": "New Kingdom, 18th Dynasty (c. 1334–1325 BCE)",
            "origin": "Mortuary Temple of Eye and Horemheb, Medinet Habu, Thebes, Egypt",
            "category": "Royal Statuary",
            "significance": "The tallest ancient Egyptian statue in the Western Hemisphere, originally erected in Tutankhamun's mortuary temple.",
            "facts": ["Tallest ancient Egyptian statue in the Western Hemisphere", "Carved from high-grade quartzite with remnants of royal red paint", "Re-carved by Pharaohs Eye and Horemheb after Tutankhamun's early death"]
        },
        {
            "key": "exhibit_sarcophagus",
            "title": "Granite Sarcophagus of Vizier Bakenranef",
            "room": "Egypt",
            "x": 0.800, "y": 0.400,
            "desc": "Monumental 8-ton black granodiorite sarcophagus of the high royal vizier Bakenranef, incised with elaborate protective spells from the Book of the Dead and Book of Amduat.",
            "period": "Late Period, 26th Saite Dynasty (c. 664–525 BCE)",
            "origin": "Saqqara Necropolis, Egypt",
            "category": "Funerary Monument",
            "significance": "Exemplifies the archaizing Renaissance style of the 26th Dynasty reviving Old Kingdom mortuary grandeur.",
            "facts": ["Monumental hard black granodiorite sarcophagus weighing 8 tons", "Incised with chapters from the Book of the Amduat and Book of the Dead", "Inscriptions invoke Isis, Nephthys, and Anubis to protect the vizier"]
        },
        {
            "key": "exhibit_petosiris_coffin",
            "title": "Polychrome Painted Coffin of Petosiris",
            "room": "Egypt",
            "x": 0.800, "y": 0.525,
            "desc": "Elaborately painted wooden inner coffin (~300 BCE) adorned with brilliant mineral pigments and protective spells, depicting the deceased Petosiris welcomed by Osiris, Isis, and Anubis.",
            "period": "Ptolemaic Period (c. 300 BCE)",
            "origin": "Hermopolis Magna (Tuna el-Gebel), Middle Egypt",
            "category": "Funerary Arts",
            "significance": "Rare completely preserved anthropoid coffin showing Greek and Egyptian artistic fusion in the early Hellenistic era.",
            "facts": ["Made of native sycamore fig wood with brilliant mineral pigment paintings", "Features the deceased Petosiris presented before Osiris and 42 assessor gods", "Includes intact cartonnage mummy mask and protective collar"]
        },
        {
            "key": "exhibit_egypt_book_of_dead",
            "title": "Papyrus of Nes-Min: Book of the Dead Scroll",
            "room": "Egypt",
            "x": 0.800, "y": 0.600,
            "desc": "Masterpiece hieratic funerary papyrus scroll extending over 25 feet, illustrated with vignettes of the Weighing of the Heart judgment before Osiris in the Hall of Truth.",
            "period": "Ptolemaic Period (c. 300–250 BCE)",
            "origin": "Akhmim, Upper Egypt",
            "category": "Hieroglyphic Papyrus",
            "significance": "One of the best-preserved continuous papyri detailing ancient Egyptian afterlife theology.",
            "facts": ["Over 25 feet of unbroken papyrus written in fine hieratic script", "Contains the Weighing of the Heart spell (Chapter 125)", "Illustrated with vignettes of the jackal-headed god Anubis and Thoth"]
        },
        {
            "key": "exhibit_persepolis_capital",
            "title": "Persepolis Column Capital with Double Bull Protome",
            "room": "Persia",
            "x": 0.810, "y": 0.770,
            "desc": "Enormous carved stone capital (~500 BCE) from the Apadana audience palace of Darius the Great and Xerxes at Persepolis, weighing over 10 tons and featuring twin kneeling royal bulls.",
            "period": "Achaemenid Persian Empire (c. 518–465 BCE)",
            "origin": "Apadana Palace (Audience Hall), Persepolis, Iran",
            "category": "Architectural Sculpture",
            "significance": "Towered 65 feet above the palace floor, holding up monumental cedar beams imported from Lebanon.",
            "facts": ["Carved from native dark gray Persepolis limestone weighing over 10 tons", "Two kneeling bulls back-to-back supported giant Lebanese cedar roof beams", "Excavated during the Oriental Institute Persepolis Expedition in the 1930s"]
        },
        {
            "key": "exhibit_kerma_beaker",
            "title": "Kerma Classic Tulip-Shaped Decorated Beaker",
            "room": "Nubia",
            "x": 0.605, "y": 0.635,
            "desc": "Paper-thin black-topped red burnished ceramic beaker (~1750-1550 BCE) with a lustrous metallic sheen and silver-gray band from the Kingdom of Kush at Kerma.",
            "period": "Kingdom of Kush, Classic Kerma (c. 1750–1550 BCE)",
            "origin": "Royal Necropolis of Kerma, Northern Sudan",
            "category": "Nubian Ceramics",
            "significance": "Represents the pinnacle of African pottery technology achieved without the use of a potter's wheel.",
            "facts": ["Eggshell-thin black-topped red burnished ceramic vessel", "Features a distinctive silvery-gray metallic band around the rim", "Crafted entirely by hand without a potter's wheel"]
        },
        {
            "key": "exhibit_silk_road_seals",
            "title": "Silk Road Bactrian Bronze Mirror & Sealstones",
            "room": "Temporary Exhibits",
            "x": 0.410, "y": 0.635,
            "desc": "Rare trans-Eurasian trade relics including engraved carnelian seals and Hellenistic bronze mirror backs demonstrating cultural synthesis along the ancient Silk Road.",
            "period": "Hellenistic–Bactrian Period (c. 250 BCE – 100 CE)",
            "origin": "Bactria-Margiana Archaeological Complex, Central Asia",
            "category": "Silk Road Antiquities",
            "significance": "Testifies to the vibrant trade and intellectual exchange linking the Mediterranean, Persia, Central Asia, and China.",
            "facts": ["Engraved with syncretic Greek and Persian mythological figures", "Demonstrates vibrant long-distance caravan trade across ancient Eurasia", "Polished reflective bronze face with elaborate repoussé relief back"]
        },
        {
            "key": "exhibit_breasted_podium",
            "title": "Historic 1931 Hand-Carved Oak Lecture Rostrum",
            "room": "Breasted Lecture Hall",
            "x": 0.480, "y": 0.770,
            "desc": "The iconic auditorium rostrum from where James Henry Breasted and world-renowned archaeologists presented breakthrough excavations to the scientific community.",
            "period": "Art Deco / Gothic Revival (1931)",
            "origin": "Oriental Institute Auditorium, Chicago",
            "category": "Institutional Heritage",
            "significance": "Commemorates the global legacy of scientific archaeology and excavation dissemination.",
            "facts": ["Crafted from American white oak with carved Egyptian lotus and cuneiform motifs", "Site of inaugural archaeological lectures by Breasted and Henry Frankfort", "Remains in active use for international Near Eastern symposiums"]
        }
    ]

    # 9. Define Navigation Hubs, Doorways, and Waypoints
    waypoints_data = [
        # Main Exterior Entrance
        {"key": "node_main_entrance", "title": "Main Entrance Threshold", "room": "Lobby", "x": 0.070, "y": 0.790, "type": "entrance,exit"},
        
        # Doorway Nodes (connecting rooms through open architectural portals)
        {"key": "node_door_lobby_store", "title": "Lobby / Store Portal", "room": "Lobby", "x": 0.190, "y": 0.720, "type": "doorway"},
        {"key": "node_door_store_orientation", "title": "Store / Orientation Portal", "room": "Museum Store", "x": 0.190, "y": 0.640, "type": "doorway"},
        {"key": "node_door_orientation_prehistory", "title": "Orientation / Prehistory Portal", "room": "Visitor Orientation", "x": 0.195, "y": 0.540, "type": "doorway"},
        {"key": "node_door_prehistory_mesopotamia", "title": "Prehistory / Mesopotamia Portal", "room": "Prehistory", "x": 0.195, "y": 0.420, "type": "doorway"},
        {"key": "node_door_mesopotamia_khorsabad", "title": "Mesopotamia / Khorsabad Portal", "room": "Mesopotamia", "x": 0.195, "y": 0.170, "type": "doorway"},
        {"key": "node_door_khorsabad_assyria", "title": "Khorsabad / Assyria Portal", "room": "Khorsabad Court", "x": 0.280, "y": 0.190, "type": "doorway"},
        {"key": "node_door_assyria_syria", "title": "Assyria / Syria Portal", "room": "Assyria", "x": 0.460, "y": 0.190, "type": "doorway"},
        {"key": "node_door_syria_megiddo", "title": "Syria / Megiddo Portal", "room": "Syria & Anatolia", "x": 0.720, "y": 0.190, "type": "doorway"},
        {"key": "node_door_megiddo_egypt", "title": "Megiddo / Egypt Portal", "room": "Megiddo", "x": 0.800, "y": 0.270, "type": "doorway"},
        {"key": "node_door_egypt_nubia", "title": "Egypt / Nubia Portal", "room": "Egypt", "x": 0.680, "y": 0.635, "type": "doorway"},
        {"key": "node_door_egypt_persia", "title": "Egypt / Persia Portal", "room": "Egypt", "x": 0.800, "y": 0.680, "type": "doorway"},
        {"key": "node_door_nubia_temp", "title": "Nubia / Temp Exhibits Portal", "room": "Nubia", "x": 0.480, "y": 0.635, "type": "doorway"},
        {"key": "node_door_temp_west", "title": "Temp Exhibits / West Corridor Portal", "room": "Temporary Exhibits", "x": 0.280, "y": 0.635, "type": "doorway"},
        {"key": "node_door_lobby_breasted", "title": "Lobby / Breasted Hall Portal", "room": "Lobby", "x": 0.280, "y": 0.770, "type": "doorway"},
        {"key": "node_door_courtyard_north", "title": "Courtyard North Portal", "room": "Courtyard", "x": 0.505, "y": 0.270, "type": "doorway"},
        {"key": "node_door_courtyard_south", "title": "Courtyard South Portal", "room": "Courtyard", "x": 0.505, "y": 0.585, "type": "doorway"},

        # Gallery Central Hubs & Waypoint Junctions
        {"key": "hub_lobby", "title": "Grand Lobby Reception Center", "room": "Lobby", "x": 0.190, "y": 0.770, "type": "junction"},
        {"key": "hub_store", "title": "Museum Store Center", "room": "Museum Store", "x": 0.190, "y": 0.675, "type": "hallway"},
        {"key": "hub_orientation", "title": "Visitor Orientation Center", "room": "Visitor Orientation", "x": 0.195, "y": 0.590, "type": "junction"},
        {"key": "hub_prehistory", "title": "Prehistory Gallery Center", "room": "Prehistory", "x": 0.195, "y": 0.480, "type": "hallway"},
        {"key": "hub_mesopotamia_south", "title": "Mesopotamia Gallery South Hub", "room": "Mesopotamia", "x": 0.195, "y": 0.345, "type": "junction"},
        {"key": "hub_mesopotamia_north", "title": "Mesopotamia Gallery North Hub", "room": "Mesopotamia", "x": 0.195, "y": 0.220, "type": "junction"},
        {"key": "hub_khorsabad", "title": "Khorsabad Court Center", "room": "Khorsabad Court", "x": 0.195, "y": 0.105, "type": "junction"},
        {"key": "hub_assyria", "title": "Assyria Gallery Center", "room": "Assyria", "x": 0.370, "y": 0.190, "type": "junction"},
        {"key": "hub_syria", "title": "Syria & Anatolia Center", "room": "Syria & Anatolia", "x": 0.590, "y": 0.190, "type": "junction"},
        {"key": "hub_megiddo", "title": "Megiddo Gallery Center", "room": "Megiddo", "x": 0.800, "y": 0.190, "type": "junction"},
        {"key": "hub_egypt_north", "title": "Egypt Gallery North Hub", "room": "Egypt", "x": 0.800, "y": 0.360, "type": "junction"},
        {"key": "hub_egypt_mid", "title": "Egypt Gallery Grand Colonnade", "room": "Egypt", "x": 0.800, "y": 0.460, "type": "junction"},
        {"key": "hub_egypt_south", "title": "Egypt Gallery South Hub", "room": "Egypt", "x": 0.800, "y": 0.635, "type": "junction"},
        {"key": "hub_persia", "title": "Persia Gallery Center", "room": "Persia", "x": 0.800, "y": 0.770, "type": "hallway"},
        {"key": "hub_nubia", "title": "Nubia Gallery Center", "room": "Nubia", "x": 0.580, "y": 0.635, "type": "hallway"},
        {"key": "hub_temp", "title": "Temporary Exhibits Center", "room": "Temporary Exhibits", "x": 0.380, "y": 0.635, "type": "junction"},
        {"key": "hub_breasted", "title": "Breasted Lecture Hall Center", "room": "Breasted Lecture Hall", "x": 0.480, "y": 0.770, "type": "hallway"},
        {"key": "hub_courtyard_center", "title": "Courtyard Fountain Walkway", "room": "Courtyard", "x": 0.505, "y": 0.420, "type": "junction"}
    ]

    node_db_ids = {}

    # Insert exhibits into objects, artifacts, and map_nodes with full rich curator metadata
    for ex in exhibits_data:
        ex_x, ex_y = float(ex["x"]), float(ex["y"])
        lat = lat0 + ex_y * scale_y
        lng = lng0 + ex_x * scale_x
        gal_id = gallery_db_ids.get(ex["room"])

        # 1. Insert into objects table
        obj_row = execute_query(
            """
            INSERT INTO objects (
                museum_id, gallery_id, name, description, category, period, origin, significance, facts, latitude, longitude,
                featured, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::json, %s, %s, TRUE, NOW(), NOW()) RETURNING id
            """,
            (
                MUSEUM_ID, gal_id, ex["title"], ex["desc"], ex["category"],
                ex.get("period"), ex.get("origin"), ex.get("significance"),
                json.dumps(ex.get("facts", [])),
                lat, lng
            ),
            fetchone=True, commit=True
        )
        obj_id = obj_row[0]

        # 2. Insert into artifacts table
        art_row = execute_query(
            """
            INSERT INTO artifacts (
                floor_plan_id, name, description, map_x, map_y, latitude, longitude, created_at
            ) VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, NOW()) RETURNING id
            """,
            (plan_id, ex["title"], ex["desc"], ex["x"], ex["y"], lat, lng),
            fetchone=True, commit=True
        )
        art_id = str(art_row[0])

        # 3. Insert into map_nodes table
        node_row = execute_query(
            """
            INSERT INTO map_nodes (
                name, floor, x_coordinate, y_coordinate, node_type,
                floor_plan_id, latitude, longitude, artifact_id, object_id, is_must_visit, created_at
            ) VALUES (%s, %s, %s, %s, 'exhibit', %s::uuid, %s, %s, %s::uuid, %s, TRUE, NOW()) RETURNING id
            """,
            (ex["title"], FLOOR_NUM, ex["x"], ex["y"], plan_id, lat, lng, art_id, obj_id),
            fetchone=True, commit=True
        )
        node_db_ids[ex["key"]] = str(node_row[0])
        print(f"✓ Exhibit created: {ex['title']} in {ex['room']} (node_id={node_row[0]})")

    # Insert waypoints, hubs, and doorways into map_nodes
    for wp in waypoints_data:
        wp_x, wp_y = float(wp["x"]), float(wp["y"])
        lat = lat0 + wp_y * scale_y
        lng = lng0 + wp_x * scale_x

        node_row = execute_query(
            """
            INSERT INTO map_nodes (
                name, floor, x_coordinate, y_coordinate, node_type,
                floor_plan_id, latitude, longitude, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s::uuid, %s, %s, NOW()) RETURNING id
            """,
            (wp["title"], FLOOR_NUM, wp["x"], wp["y"], wp["type"], plan_id, lat, lng),
            fetchone=True, commit=True
        )
        node_db_ids[wp["key"]] = str(node_row[0])
        print(f"✓ Waypoint created: {wp['title']} (node_id={node_row[0]})")

    # 10. Complete Navigation Graph Edges
    all_nodes_dict = {
        **{e["key"]: e for e in exhibits_data},
        **{w["key"]: w for w in waypoints_data}
    }

    edges_spec = [
        # --- ENTRANCE & LOBBY SPINE ---
        ("node_main_entrance", "hub_lobby"),
        ("hub_lobby", "exhibit_info_kiosk"),
        ("hub_lobby", "node_door_lobby_store"),
        ("hub_lobby", "node_door_lobby_breasted"),

        # --- BREASTED LECTURE HALL ---
        ("node_door_lobby_breasted", "hub_breasted"),
        ("hub_breasted", "exhibit_breasted_podium"),

        # --- MUSEUM STORE ---
        ("node_door_lobby_store", "hub_store"),
        ("hub_store", "exhibit_suq_store"),
        ("hub_store", "node_door_store_orientation"),

        # --- VISITOR ORIENTATION ---
        ("node_door_store_orientation", "hub_orientation"),
        ("hub_orientation", "exhibit_breasted_timeline"),
        ("hub_orientation", "node_door_orientation_prehistory"),
        ("hub_orientation", "node_door_temp_west"),

        # --- PREHISTORY GALLERY ---
        ("node_door_orientation_prehistory", "hub_prehistory"),
        ("hub_prehistory", "exhibit_jarmo_goddess"),
        ("hub_prehistory", "exhibit_hassuna_pottery"),
        ("hub_prehistory", "node_door_prehistory_mesopotamia"),

        # --- MESOPOTAMIA GALLERY ---
        ("node_door_prehistory_mesopotamia", "hub_mesopotamia_south"),
        ("hub_mesopotamia_south", "exhibit_gilgamesh_tablet"),
        ("hub_mesopotamia_south", "exhibit_babylonian_lion"),
        ("hub_mesopotamia_south", "hub_mesopotamia_north"),
        ("hub_mesopotamia_north", "exhibit_sumerian_worshiper"),
        ("hub_mesopotamia_north", "node_door_mesopotamia_khorsabad"),

        # --- KHORSABAD COURT ---
        ("node_door_mesopotamia_khorsabad", "hub_khorsabad"),
        ("hub_khorsabad", "exhibit_khorsabad_lamassu"),
        ("hub_khorsabad", "exhibit_sargon_relief"),
        ("hub_khorsabad", "node_door_khorsabad_assyria"),

        # --- ASSYRIA GALLERY ---
        ("node_door_khorsabad_assyria", "hub_assyria"),
        ("hub_assyria", "exhibit_ashurnasirpal_stele"),
        ("hub_assyria", "node_door_assyria_syria"),

        # --- SYRIA & ANATOLIA GALLERY ---
        ("node_door_assyria_syria", "hub_syria"),
        ("hub_syria", "exhibit_tayinat_column"),
        ("hub_syria", "exhibit_syrian_bronzes"),
        ("hub_syria", "node_door_syria_megiddo"),
        ("hub_syria", "node_door_courtyard_north"),

        # --- MEGIDDO GALLERY ---
        ("node_door_syria_megiddo", "hub_megiddo"),
        ("hub_megiddo", "exhibit_megiddo_ivories"),
        ("hub_megiddo", "node_door_megiddo_egypt"),

        # --- EGYPT GALLERY SPINE ---
        ("node_door_megiddo_egypt", "hub_egypt_north"),
        ("hub_egypt_north", "exhibit_king_tut"),
        ("hub_egypt_north", "exhibit_sarcophagus"),
        ("hub_egypt_north", "hub_egypt_mid"),
        ("hub_egypt_mid", "exhibit_petosiris_coffin"),
        ("hub_egypt_mid", "hub_egypt_south"),
        ("hub_egypt_south", "exhibit_egypt_book_of_dead"),
        ("hub_egypt_south", "node_door_egypt_persia"),
        ("hub_egypt_south", "node_door_egypt_nubia"),

        # --- PERSIA GALLERY ---
        ("node_door_egypt_persia", "hub_persia"),
        ("hub_persia", "exhibit_persepolis_capital"),

        # --- NUBIA GALLERY ---
        ("node_door_egypt_nubia", "hub_nubia"),
        ("hub_nubia", "exhibit_kerma_beaker"),
        ("hub_nubia", "node_door_nubia_temp"),

        # --- TEMPORARY EXHIBITS ---
        ("node_door_nubia_temp", "hub_temp"),
        ("hub_temp", "exhibit_silk_road_seals"),
        ("hub_temp", "node_door_temp_west"),
        ("hub_temp", "node_door_courtyard_south"),

        # --- COURTYARD & FOUNTAIN ---
        ("node_door_courtyard_north", "hub_courtyard_center"),
        ("hub_courtyard_center", "exhibit_courtyard_fountain"),
        ("hub_courtyard_center", "node_door_courtyard_south"),
    ]

    print("\n=======================================================")
    print("Verifying and Inserting Bidirectional Map Edges...")
    print("=======================================================")

    all_rooms_check = [
        {"name": r["name"], "walkable": r["walkable"], "boundaries": [{"x": p[0], "y": p[1]} for p in r["boundaries"]]}
        for r in rooms_data
    ]

    created_edges = 0
    for a_key, b_key in edges_spec:
        na = all_nodes_dict[a_key]
        nb = all_nodes_dict[b_key]
        ida = node_db_ids[a_key]
        idb = node_db_ids[b_key]

        ax, ay = float(na["x"]), float(na["y"])
        bx, by = float(nb["x"]), float(nb["y"])

        lat1 = lat0 + ay * scale_y
        lng1 = lng0 + ax * scale_x
        lat2 = lat0 + by * scale_y
        lng2 = lng0 + bx * scale_x
        real_dist = max(1.0, round(haversine_distance(lat1, lng1, lat2, lng2), 2))

        crosses = segment_crosses_any_wall(ax, ay, bx, by, all_rooms_check, doorways_data, door_tolerance=0.08)
        assert not crosses, f"Illegal wall crossing on edge {a_key} <-> {b_key}!"

        edge_type = "door" if ("door" in a_key or "door" in b_key) else "normal"

        # Bidirectional insertion
        execute_query(
            "INSERT INTO map_edges (from_node_id, to_node_id, distance, walkable, edge_type, created_at) "
            "VALUES (%s::uuid, %s::uuid, %s, TRUE, %s, NOW())",
            (ida, idb, real_dist, edge_type), commit=True
        )
        execute_query(
            "INSERT INTO map_edges (from_node_id, to_node_id, distance, walkable, edge_type, created_at) "
            "VALUES (%s::uuid, %s::uuid, %s, TRUE, %s, NOW())",
            (idb, ida, real_dist, edge_type), commit=True
        )
        created_edges += 2
        print(f"✓ Edge: {na['title']:35s} <--> {nb['title']:35s} | Dist: {real_dist:5.2f}m")

    # 11. Register Unique QR Codes for Museum, Galleries, and Exhibits
    print("\n=======================================================")
    print("Registering Unique QR Codes for Museum, Galleries & Exhibits...")
    print("=======================================================")
    qr_entries = [
        # Main Entrance
        ("node_main_entrance", f"vanalok://museum/{MUSEUM_ID}"),
        ("node_main_entrance", f"vanalok_museum_{MUSEUM_ID}_entrance"),
        ("node_main_entrance", f"https://vanalok.app/m/{MUSEUM_ID}"),
        ("node_main_entrance", "oriental_institute_main_entrance"),

        # Gallery Room Doorway Portals
        ("node_door_lobby_store", "gallery_museum_store_entrance"),
        ("node_door_store_orientation", "gallery_visitor_orientation_entrance"),
        ("node_door_orientation_prehistory", "gallery_prehistory_entrance"),
        ("node_door_prehistory_mesopotamia", "gallery_mesopotamia_entrance"),
        ("node_door_mesopotamia_khorsabad", "gallery_khorsabad_court_entrance"),
        ("node_door_khorsabad_assyria", "gallery_assyria_entrance"),
        ("node_door_assyria_syria", "gallery_syria_anatolia_entrance"),
        ("node_door_syria_megiddo", "gallery_megiddo_entrance"),
        ("node_door_megiddo_egypt", "gallery_egypt_entrance"),
        ("node_door_egypt_nubia", "gallery_nubia_entrance"),
        ("node_door_egypt_persia", "gallery_persia_entrance"),
        ("node_door_nubia_temp", "gallery_temporary_exhibits_entrance"),
        ("node_door_lobby_breasted", "gallery_breasted_lecture_hall_entrance"),
        ("node_door_courtyard_north", "gallery_courtyard_entrance"),

        # Major Exhibit QR Codes
        ("exhibit_khorsabad_lamassu", "vanalok://object/khorsabad_lamassu"),
        ("exhibit_king_tut", "vanalok://object/king_tutankhamun"),
        ("exhibit_sarcophagus", "vanalok://object/egyptian_sarcophagus"),
        ("exhibit_sumerian_worshiper", "vanalok://object/sumerian_worshiper"),
        ("exhibit_babylonian_lion", "vanalok://object/babylonian_lion"),
        ("exhibit_gilgamesh_tablet", "vanalok://object/gilgamesh_tablet"),
        ("exhibit_megiddo_ivories", "vanalok://object/megiddo_ivories"),
        ("exhibit_persepolis_capital", "vanalok://object/persepolis_capital"),
        ("exhibit_ashurnasirpal_stele", "vanalok://object/ashurnasirpal_stele"),
        ("exhibit_tayinat_column", "vanalok://object/tell_tayinat_column"),
        ("exhibit_syrian_bronzes", "vanalok://object/syrian_bronzes"),
        ("exhibit_petosiris_coffin", "vanalok://object/petosiris_coffin"),
        ("exhibit_egypt_book_of_dead", "vanalok://object/book_of_dead"),
        ("exhibit_kerma_beaker", "vanalok://object/kerma_beaker"),
        ("exhibit_jarmo_goddess", "vanalok://object/jarmo_goddess"),
        ("exhibit_hassuna_pottery", "vanalok://object/hassuna_pottery"),
        ("exhibit_courtyard_fountain", "vanalok://object/courtyard_fountain"),
        ("exhibit_silk_road_seals", "vanalok://object/silk_road_seals"),
        ("exhibit_breasted_podium", "vanalok://object/breasted_podium"),
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
            print(f"✓ QR Registered: '{payload}' -> Node '{node_key}' ({target_node_id})")

    print("\n=================================================================")
    print(f"SUCCESS: Oriental Institute Museum setup complete!")
    print(f"Rooms: {len(room_ids)}, Exhibits: {len(exhibits_data)}, Total Nodes: {len(node_db_ids)}, Directed Edges: {created_edges}")
    print("=================================================================")

if __name__ == '__main__':
    with app.app_context():
        setup_oriental_institute_plan()
