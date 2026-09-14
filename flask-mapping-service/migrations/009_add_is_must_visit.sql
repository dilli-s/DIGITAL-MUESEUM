-- Add is_must_visit boolean column to map_nodes
ALTER TABLE map_nodes ADD COLUMN IF NOT EXISTS is_must_visit BOOLEAN DEFAULT FALSE;
