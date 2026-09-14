-- 017_clear_demo_mapping_data.sql
-- Leave the mapping service empty so administrators can create real data.

DELETE FROM qr_locations;
DELETE FROM map_edges;
DELETE FROM map_nodes;
DELETE FROM doorway_openings;
DELETE FROM room_boundaries;
DELETE FROM rooms;
DELETE FROM floor_plan_footprints;
DELETE FROM map_anchors;
DELETE FROM artifacts;
DELETE FROM floor_plans;
