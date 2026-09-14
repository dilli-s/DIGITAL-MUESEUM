-- 014_create_floor_plan_footprints.sql
-- Persist the outer building boundary for each floor plan.

CREATE TABLE IF NOT EXISTS floor_plan_footprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_plan_id UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    corner_order INTEGER NOT NULL,
    x DOUBLE PRECISION NOT NULL CHECK (x >= 0.0 AND x <= 1.0),
    y DOUBLE PRECISION NOT NULL CHECK (y >= 0.0 AND y <= 1.0),
    latitude DOUBLE PRECISION CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION CHECK (longitude >= -180.0 AND longitude <= 180.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_floor_plan_footprints_floor_plan_id
    ON floor_plan_footprints(floor_plan_id);
