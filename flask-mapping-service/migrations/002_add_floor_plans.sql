-- Migration 002: Add floor plans and update map nodes

CREATE TABLE IF NOT EXISTS floor_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    floor_number INTEGER NOT NULL,
    image_url TEXT,
    width_px INTEGER,
    height_px INTEGER,
    scale_meters_per_px FLOAT,
    is_outdoor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alter map_nodes to add foreign keys
ALTER TABLE map_nodes ADD COLUMN IF NOT EXISTS floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE;
ALTER TABLE map_nodes ADD COLUMN IF NOT EXISTS object_id INTEGER;

-- Update node_type constraint
-- First drop the existing constraint
ALTER TABLE map_nodes DROP CONSTRAINT IF EXISTS map_nodes_node_type_check;

-- Then add the new constraint
ALTER TABLE map_nodes ADD CONSTRAINT map_nodes_node_type_check 
CHECK (node_type IN ('exhibit', 'junction', 'entrance', 'exit', 'amenity', 'restroom', 'cafe', 'giftshop', 'elevator', 'stairs'));
