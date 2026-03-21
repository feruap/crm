-- Migration 008: Business Settings + Integration Settings
-- Key-value store for channel credentials (Meta, WC, Google)
-- Used by channels.ts config endpoints and webhook handlers

CREATE TABLE IF NOT EXISTS business_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Also add subtype column to channels if missing
DO $$ BEGIN
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS subtype TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
