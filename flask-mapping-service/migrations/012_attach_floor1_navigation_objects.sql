-- 012_attach_floor1_navigation_objects.sql
-- Attach the supplied first-floor image and existing museum objects to the
-- seven-room plan created by migration 011.

UPDATE floor_plans
SET name = 'Floor 1 - Example Museum Residence',
    floor_number = 1,
    image_url = '/api/static/uploads/3500ff6854b54e0db040c9c7b80d7fe8.png',
    width_px = 588,
    height_px = 364,
    scale_meters_per_px = 0.05
WHERE id = 'e1000000-0000-0000-0000-000000000003';

UPDATE map_nodes
SET floor = 1
WHERE floor_plan_id = 'e1000000-0000-0000-0000-000000000003';

-- Existing catalog objects are represented as floor-plan artifacts.
INSERT INTO artifacts (id, floor_plan_id, name, description, map_x, map_y)
VALUES
    ('e2000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000003', 'T-Rex Skeleton', 'Existing museum object 1.', 0.34, 0.27),
    ('e2000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000003', 'Triceratops Skull', 'Existing museum object 2.', 0.55, 0.27),
    ('e2000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000003', 'Lucy Australopithecus', 'Existing museum object 3.', 0.78, 0.27),
    ('e2000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000003', 'Number 1A, 1948', 'Existing museum object 4.', 0.40, 0.65),
    ('e2000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000003', 'Great Sphinx of Tanis', 'Existing museum object 5.', 0.72, 0.65),
    ('e2000000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000003', 'Mona Lisa', 'Existing museum object 6.', 0.90, 0.65)
ON CONFLICT (id) DO UPDATE SET
    floor_plan_id = EXCLUDED.floor_plan_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    map_x = EXCLUDED.map_x,
    map_y = EXCLUDED.map_y;

-- Link six exhibit stops to the catalog object IDs used by the backend.
INSERT INTO map_nodes (id, name, floor, x_coordinate, y_coordinate, node_type, floor_plan_id, object_id, artifact_id, is_must_visit)
VALUES
    ('e3000000-0000-0000-0000-000000000022', 'T-Rex Skeleton Exhibit', 1, 0.34, 0.27, 'exhibit', 'e1000000-0000-0000-0000-000000000003', 1, 'e2000000-0000-0000-0000-000000000007', TRUE),
    ('e3000000-0000-0000-0000-000000000023', 'Triceratops Skull Exhibit', 1, 0.55, 0.27, 'exhibit', 'e1000000-0000-0000-0000-000000000003', 2, 'e2000000-0000-0000-0000-000000000008', TRUE),
    ('e3000000-0000-0000-0000-000000000024', 'Lucy Exhibit', 1, 0.78, 0.27, 'exhibit', 'e1000000-0000-0000-0000-000000000003', 3, 'e2000000-0000-0000-0000-000000000009', TRUE),
    ('e3000000-0000-0000-0000-000000000025', 'Number 1A Exhibit', 1, 0.40, 0.65, 'exhibit', 'e1000000-0000-0000-0000-000000000003', 4, 'e2000000-0000-0000-0000-000000000010', TRUE),
    ('e3000000-0000-0000-0000-000000000026', 'Great Sphinx Exhibit', 1, 0.72, 0.65, 'exhibit', 'e1000000-0000-0000-0000-000000000003', 5, 'e2000000-0000-0000-0000-000000000011', TRUE),
    ('e3000000-0000-0000-0000-000000000027', 'Mona Lisa Exhibit', 1, 0.90, 0.65, 'exhibit', 'e1000000-0000-0000-0000-000000000003', 6, 'e2000000-0000-0000-0000-000000000012', TRUE)
ON CONFLICT (id) DO UPDATE SET
    floor = EXCLUDED.floor,
    name = EXCLUDED.name,
    x_coordinate = EXCLUDED.x_coordinate,
    y_coordinate = EXCLUDED.y_coordinate,
    object_id = EXCLUDED.object_id,
    artifact_id = EXCLUDED.artifact_id,
    is_must_visit = EXCLUDED.is_must_visit;

-- Connect the existing floor junction to every catalog object stop.
INSERT INTO map_edges (id, from_node_id, to_node_id, distance, walkable)
VALUES
    ('e4000000-0000-0000-0000-000000000024', 'e3000000-0000-0000-0000-000000000010', 'e3000000-0000-0000-0000-000000000022', 8.0, TRUE),
    ('e4000000-0000-0000-0000-000000000025', 'e3000000-0000-0000-0000-000000000010', 'e3000000-0000-0000-0000-000000000023', 10.0, TRUE),
    ('e4000000-0000-0000-0000-000000000026', 'e3000000-0000-0000-0000-000000000010', 'e3000000-0000-0000-0000-000000000024', 14.0, TRUE),
    ('e4000000-0000-0000-0000-000000000027', 'e3000000-0000-0000-0000-000000000010', 'e3000000-0000-0000-0000-000000000025', 9.0, TRUE),
    ('e4000000-0000-0000-0000-000000000028', 'e3000000-0000-0000-0000-000000000010', 'e3000000-0000-0000-0000-000000000026', 13.0, TRUE),
    ('e4000000-0000-0000-0000-000000000029', 'e3000000-0000-0000-0000-000000000010', 'e3000000-0000-0000-0000-000000000027', 16.0, TRUE)
ON CONFLICT (id) DO NOTHING;
