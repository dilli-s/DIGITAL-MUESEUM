CREATE TABLE IF NOT EXISTS map_anchors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_plan_id UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    map_x DOUBLE PRECISION NOT NULL CHECK (map_x >= 0.0 AND map_x <= 1.0),
    map_y DOUBLE PRECISION NOT NULL CHECK (map_y >= 0.0 AND map_y <= 1.0),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180.0 AND longitude <= 180.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_map_anchors_floor_plan_id ON map_anchors(floor_plan_id);

-- Note: Migration of existing anchor_1/anchor_2 data from floor_plans to map_anchors would go here.
-- Assuming we want normalized coordinates, we need to divide by width_px and height_px.
INSERT INTO map_anchors (floor_plan_id, map_x, map_y, latitude, longitude)
SELECT 
    id, 
    anchor_1_x_px / NULLIF(width_px, 0), 
    anchor_1_y_px / NULLIF(height_px, 0), 
    anchor_1_lat, 
    anchor_1_lng 
FROM floor_plans 
WHERE anchor_1_lat IS NOT NULL;

INSERT INTO map_anchors (floor_plan_id, map_x, map_y, latitude, longitude)
SELECT 
    id, 
    anchor_2_x_px / NULLIF(width_px, 0), 
    anchor_2_y_px / NULLIF(height_px, 0), 
    anchor_2_lat, 
    anchor_2_lng 
FROM floor_plans 
WHERE anchor_2_lat IS NOT NULL;
