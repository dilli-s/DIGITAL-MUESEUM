-- 002_add_anchors_and_nodes.sql
CREATE TABLE IF NOT EXISTS map_anchors (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    map_x DOUBLE PRECISION NOT NULL CHECK (map_x >= 0.0 AND map_x <= 1.0),
    map_y DOUBLE PRECISION NOT NULL CHECK (map_y >= 0.0 AND map_y <= 1.0),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS map_nodes (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    x DOUBLE PRECISION NOT NULL CHECK (x >= 0.0 AND x <= 1.0),
    y DOUBLE PRECISION NOT NULL CHECK (y >= 0.0 AND y <= 1.0),
    latitude DOUBLE PRECISION CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION CHECK (longitude >= -180 AND longitude <= 180),
    node_type VARCHAR(100) NOT NULL,
    name VARCHAR(255),
    is_manually_corrected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS map_edges (
    id SERIAL PRIMARY KEY,
    from_node INTEGER NOT NULL REFERENCES map_nodes(id) ON DELETE CASCADE,
    to_node INTEGER NOT NULL REFERENCES map_nodes(id) ON DELETE CASCADE,
    distance_m DOUBLE PRECISION NOT NULL,
    walkable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
