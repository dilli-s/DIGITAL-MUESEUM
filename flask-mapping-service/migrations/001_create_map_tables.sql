CREATE TABLE IF NOT EXISTS map_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    floor INTEGER NOT NULL,
    x_coordinate FLOAT NOT NULL,
    y_coordinate FLOAT NOT NULL,
    node_type TEXT CHECK (node_type IN ('exhibit', 'junction', 'entrance', 'exit', 'amenity')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS map_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_node_id UUID REFERENCES map_nodes(id) ON DELETE CASCADE,
    to_node_id UUID REFERENCES map_nodes(id) ON DELETE CASCADE,
    distance FLOAT NOT NULL,
    walkable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_map_edges_from_node_id ON map_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_map_edges_to_node_id ON map_edges(to_node_id);
