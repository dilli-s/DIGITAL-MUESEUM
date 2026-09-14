-- 013_allow_ungeoreferenced_rooms.sql
-- Room geometry must be saveable before GPS georeferencing is complete.

ALTER TABLE room_boundaries ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE room_boundaries ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE room_boundaries ADD COLUMN IF NOT EXISTS is_manually_corrected BOOLEAN DEFAULT FALSE;
ALTER TABLE room_boundaries ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP;

ALTER TABLE doorway_openings ADD COLUMN IF NOT EXISTS connected_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE doorway_openings ADD COLUMN IF NOT EXISTS name TEXT;
