-- Migration 019: Enforce that object/exhibit type nodes must link to a real artifact
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'map_nodes'::regclass AND conname = 'chk_object_node_requires_artifact'
    ) THEN
        ALTER TABLE map_nodes
        ADD CONSTRAINT chk_object_node_requires_artifact
        CHECK (
            (node_type NOT IN ('exhibit', 'artifact', 'object') 
             AND (node_type IS NULL OR (node_type NOT LIKE '%exhibit%' AND node_type NOT LIKE '%artifact%')))
            OR artifact_id IS NOT NULL
        );
    END IF;
END $$;
