-- 003_add_rooms_and_artifacts.sql
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    room_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_boundaries (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    corner_order INTEGER NOT NULL,
    x DOUBLE PRECISION NOT NULL CHECK (x >= 0.0 AND x <= 1.0),
    y DOUBLE PRECISION NOT NULL CHECK (y >= 0.0 AND y <= 1.0),
    latitude DOUBLE PRECISION CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION CHECK (longitude >= -180 AND longitude <= 180),
    is_manually_corrected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floor_plan_boundaries (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    corner_order INTEGER NOT NULL,
    x DOUBLE PRECISION NOT NULL CHECK (x >= 0.0 AND x <= 1.0),
    y DOUBLE PRECISION NOT NULL CHECK (y >= 0.0 AND y <= 1.0),
    latitude DOUBLE PRECISION CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION CHECK (longitude >= -180 AND longitude <= 180),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artifacts (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    map_x DOUBLE PRECISION NOT NULL CHECK (map_x >= 0.0 AND map_x <= 1.0),
    map_y DOUBLE PRECISION NOT NULL CHECK (map_y >= 0.0 AND map_y <= 1.0),
    latitude DOUBLE PRECISION CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION CHECK (longitude >= -180 AND longitude <= 180),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qr_locations (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    node_id INTEGER NOT NULL REFERENCES map_nodes(id) ON DELETE CASCADE,
    qr_payload TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_nodes_floor_plan ON map_nodes(floor_plan_id);
CREATE INDEX idx_edges_from_node ON map_edges(from_node);
CREATE INDEX idx_edges_to_node ON map_edges(to_node);
CREATE INDEX idx_artifacts_floor_plan ON artifacts(floor_plan_id);
CREATE INDEX idx_qr_locations_payload ON qr_locations(qr_payload);
