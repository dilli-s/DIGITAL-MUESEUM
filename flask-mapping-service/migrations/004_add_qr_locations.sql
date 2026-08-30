CREATE TABLE IF NOT EXISTS qr_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_plan_id UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES map_nodes(id) ON DELETE CASCADE,
    qr_payload TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_locations_floor_plan_id ON qr_locations(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_qr_locations_node_id ON qr_locations(node_id);
