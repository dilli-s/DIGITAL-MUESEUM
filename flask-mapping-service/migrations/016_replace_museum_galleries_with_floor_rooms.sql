-- 016_replace_museum_galleries_with_floor_rooms.sql
-- Align the National History Museum gallery list with the seven rooms
-- represented on the uploaded Floor 1 plan.

-- Existing gallery polygons are stale and must not compete with room geometry.
UPDATE galleries
SET boundary_polygon = NULL
WHERE boundary_polygon IS NOT NULL;

-- Preserve gallery IDs 1 and 2 because existing objects reference them.
UPDATE galleries
SET name = 'Stair Landing',
    description = 'Main stair landing and floor entrance.',
    floor = '1',
    boundary_polygon = NULL
WHERE id = 1;

UPDATE galleries
SET name = 'Kitchen',
    description = 'Kitchen room on the first-floor plan.',
    floor = '1',
    boundary_polygon = NULL
WHERE id = 2;

INSERT INTO galleries (id, museum_id, name, description, floor, boundary_polygon)
VALUES
    (10, 1, 'Bedroom 1', 'First-floor bedroom 1.', '1', NULL),
    (11, 1, 'Bedroom 2', 'First-floor bedroom 2.', '1', NULL),
    (12, 1, 'Main Hall', 'Central first-floor hall.', '1', NULL),
    (13, 1, 'Bathroom 1', 'First-floor bathroom 1.', '1', NULL),
    (14, 1, 'Bathroom 2', 'First-floor bathroom 2.', '1', NULL)
ON CONFLICT (id) DO UPDATE SET
    museum_id = EXCLUDED.museum_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    floor = EXCLUDED.floor,
    boundary_polygon = NULL;

SELECT setval(
    pg_get_serial_sequence('galleries', 'id'),
    GREATEST((SELECT MAX(id) FROM galleries), 1),
    TRUE
);
