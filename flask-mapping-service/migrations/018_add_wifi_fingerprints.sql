CREATE TABLE IF NOT EXISTS wifi_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    readings JSONB NOT NULL DEFAULT '[]'::jsonb,
    surveyed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wifi_fingerprints_room_id ON wifi_fingerprints(room_id);
CREATE INDEX IF NOT EXISTS idx_wifi_fingerprints_surveyed_at ON wifi_fingerprints(surveyed_at);
