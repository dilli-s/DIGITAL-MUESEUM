CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_plan_id UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    map_x DOUBLE PRECISION NOT NULL CHECK (map_x >= 0.0 AND map_x <= 1.0),
    map_y DOUBLE PRECISION NOT NULL CHECK (map_y >= 0.0 AND map_y <= 1.0),
    latitude DOUBLE PRECISION CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION CHECK (longitude >= -180.0 AND longitude <= 180.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artifacts_floor_plan_id ON artifacts(floor_plan_id);
