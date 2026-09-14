-- Migration 008: Add rooms, room_boundaries, and doorway_openings tables

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_plan_id UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    room_type VARCHAR(100) DEFAULT 'gallery',
    walkable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_boundaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    corner_order INT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS doorway_openings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    x1 FLOAT NOT NULL,
    y1 FLOAT NOT NULL,
    x2 FLOAT NOT NULL,
    y2 FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rooms_floor_plan_id ON rooms(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_room_boundaries_room_id ON room_boundaries(room_id);
CREATE INDEX IF NOT EXISTS idx_doorway_openings_room_id ON doorway_openings(room_id);
