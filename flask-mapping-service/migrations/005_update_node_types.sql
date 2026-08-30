DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'node_type_enum' AND e.enumlabel = 'elevator') THEN 
        ALTER TYPE node_type_enum ADD VALUE 'elevator'; 
    END IF; 
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'node_type_enum' AND e.enumlabel = 'stairs') THEN 
        ALTER TYPE node_type_enum ADD VALUE 'stairs'; 
    END IF; 
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'node_type_enum' AND e.enumlabel = 'artifact') THEN 
        ALTER TYPE node_type_enum ADD VALUE 'artifact'; 
    END IF; 
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'node_type_enum' AND e.enumlabel = 'amenity') THEN 
        ALTER TYPE node_type_enum ADD VALUE 'amenity'; 
    END IF; 
EXCEPTION 
    WHEN undefined_object THEN 
        NULL; 
END $$;
