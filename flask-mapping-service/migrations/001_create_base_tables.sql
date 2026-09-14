-- 001_create_base_tables.sql
CREATE TABLE IF NOT EXISTS museums (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    description TEXT,
    lat DOUBLE PRECISION CHECK (lat >= -90 AND lat <= 90),
    lng DOUBLE PRECISION CHECK (lng >= -180 AND lng <= 180),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floors (
    id SERIAL PRIMARY KEY,
    museum_id INTEGER NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
    floor_name VARCHAR(255) NOT NULL,
    floor_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floor_plans (
    id SERIAL PRIMARY KEY,
    floor_id INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    width_px INTEGER NOT NULL,
    height_px INTEGER NOT NULL,
    scale_meters_per_px DOUBLE PRECISION,
    is_outdoor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
