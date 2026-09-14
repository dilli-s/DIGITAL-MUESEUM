-- Migration 010: Phase 1 — Affine transform storage and enforced artifact linkage
-- 1. Add affine_transform column to floor_plans
ALTER TABLE floor_plans 
ADD COLUMN IF NOT EXISTS affine_transform JSONB;

-- 2. Add artifact_id foreign key to map_nodes
ALTER TABLE map_nodes 
ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL;

-- 3. Seed artifacts for existing exhibit nodes so foreign key and check constraints are satisfied
INSERT INTO artifacts (id, floor_plan_id, name, description, map_x, map_y, created_at)
VALUES 
    ('b0000001-0000-0000-0000-000000000001', 'a454627e-a61e-4901-a11e-ac27d5d76718', 'Cash Register 1920', 'Historic museum brass cash register', 0.2141, 0.9163, NOW()),
    ('b0000001-0000-0000-0000-000000000002', 'a454627e-a61e-4901-a11e-ac27d5d76718', 'Audio System Display', 'Vintage museum sound projection system', 0.9451, 0.3715, NOW()),
    ('b0000001-0000-0000-0000-000000000003', 'a454627e-a61e-4901-a11e-ac27d5d76718', 'Curator Desk', 'Original 19th-century mahogany curator workstation', 0.4727, 0.2175, NOW()),
    ('b0000001-0000-0000-0000-000000000004', 'a454627e-a61e-4901-a11e-ac27d5d76718', 'Display System 2', 'Secondary archive display unit', 0.9451, 0.6799, NOW()),
    ('b0000001-0000-0000-0000-000000000005', 'a454627e-a61e-4901-a11e-ac27d5d76718', 'Stained Glass Window', 'Restored decorative cathedral window pane', 0.0417, 0.4892, NOW()),
    ('b0000001-0000-0000-0000-000000000006', '4fd570fe-e0f0-45d4-b7f9-958109e112c1', 'Test Artifact 0', 'Test exhibit item 0', 0.0, 0.0, NOW()),
    ('b0000001-0000-0000-0000-000000000007', '4fd570fe-e0f0-45d4-b7f9-958109e112c1', 'Test Artifact 3', 'Test exhibit item 3', 0.3, 0.3, NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Link existing exhibit nodes to their corresponding seeded artifacts
UPDATE map_nodes SET artifact_id = 'b0000001-0000-0000-0000-000000000001' WHERE id = '5f85ce54-3f98-4387-bc4a-4e004569a43c' AND artifact_id IS NULL;
UPDATE map_nodes SET artifact_id = 'b0000001-0000-0000-0000-000000000002' WHERE id = 'a53db2e7-b410-4d7d-9606-489e8773584f' AND artifact_id IS NULL;
UPDATE map_nodes SET artifact_id = 'b0000001-0000-0000-0000-000000000003' WHERE id = '488a699c-8f1e-4746-bb90-49c19234493e' AND artifact_id IS NULL;
UPDATE map_nodes SET artifact_id = 'b0000001-0000-0000-0000-000000000004' WHERE id = 'e5095f07-3048-4ef5-904a-f72de91bd25e' AND artifact_id IS NULL;
UPDATE map_nodes SET artifact_id = 'b0000001-0000-0000-0000-000000000005' WHERE id = '936dd583-6578-4ff9-9c29-e7be8e6e80f6' AND artifact_id IS NULL;
UPDATE map_nodes SET artifact_id = 'b0000001-0000-0000-0000-000000000006' WHERE id = '4b00b904-8efd-439c-a29c-feed0b24a19d' AND artifact_id IS NULL;
UPDATE map_nodes SET artifact_id = 'b0000001-0000-0000-0000-000000000007' WHERE id = '3676b7b6-1cb9-4aac-aec3-52d184240730' AND artifact_id IS NULL;

-- 5. Add check constraint to map_nodes: exhibit and artifact nodes MUST have artifact_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_node_artifact_required'
    ) THEN
        ALTER TABLE map_nodes 
        ADD CONSTRAINT chk_node_artifact_required 
        CHECK (
            (node_type NOT LIKE '%exhibit%' AND node_type NOT LIKE '%artifact%') 
            OR artifact_id IS NOT NULL
        );
    END IF;
END $$;
