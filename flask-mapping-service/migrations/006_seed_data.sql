-- 006_seed_data.sql
-- Run this after running migrations to populate example data.

-- 1. Create Floors
INSERT INTO floor_plans (id, name, floor_number, width_px, height_px, is_outdoor)
VALUES 
    ('f0000000-0000-0000-0000-000000000001', 'Ground Floor Main Hall', 1, 1000, 1000, FALSE),
    ('f0000000-0000-0000-0000-000000000002', 'Second Floor Gallery', 2, 1000, 1000, FALSE)
ON CONFLICT DO NOTHING;

-- 2. Add Anchors (3 per floor)
INSERT INTO map_anchors (floor_plan_id, map_x, map_y, latitude, longitude)
VALUES
    ('f0000000-0000-0000-0000-000000000001', 0.1, 0.1, 51.5074, -0.1278),
    ('f0000000-0000-0000-0000-000000000001', 0.9, 0.1, 51.5076, -0.1275),
    ('f0000000-0000-0000-0000-000000000001', 0.5, 0.9, 51.5070, -0.1272)
ON CONFLICT DO NOTHING;

-- 3. Add Nodes
INSERT INTO map_nodes (id, floor_plan_id, x_coordinate, y_coordinate, floor, node_type, name)
VALUES 
    ('n0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 500, 900, 1, 'entrance', 'Main Entrance'),
    ('n0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 500, 500, 1, 'junction', 'Center Hall'),
    ('n0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 200, 500, 1, 'artifact', 'Dinosaur Exhibit Node'),
    ('n0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 800, 500, 1, 'stairs', 'Stairs to Floor 2')
ON CONFLICT DO NOTHING;

-- 4. Add Edges
INSERT INTO map_edges (from_node_id, to_node_id, distance, walkable)
VALUES 
    ('n0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000002', 15.0, TRUE),
    ('n0000000-0000-0000-0000-000000000002', 'n0000000-0000-0000-0000-000000000003', 10.0, TRUE),
    ('n0000000-0000-0000-0000-000000000002', 'n0000000-0000-0000-0000-000000000004', 10.0, TRUE)
ON CONFLICT DO NOTHING;

-- 5. Add Artifacts
INSERT INTO artifacts (id, floor_plan_id, name, description, map_x, map_y)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'T-Rex Skeleton', 'Massive ancient fossil.', 0.2, 0.5),
    ('a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Ancient Vase', 'Greek era.', 0.8, 0.2)
ON CONFLICT DO NOTHING;

-- 6. Add QR Locations
INSERT INTO qr_locations (floor_plan_id, node_id, qr_payload)
VALUES
    ('f0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000001'),
    ('f0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000003', 'n0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;
