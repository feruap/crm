-- Migration 004: Phase 4 — Advanced Attribution
-- Adds: attribution model config, enhanced touchpoints, CAPI event log
-- Date: 2026-03-19

-- ─────────────────────────────────────────────
-- 1. Attribution Model Configuration
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attribution_config (
    id SERIAL PRIMARY KEY,
    model_type TEXT NOT NULL DEFAULT 'last_touch' CHECK (model_type IN (
        'first_touch', 'last_touch', 'linear', 'time_decay', 'position_based'
    )),
    time_decay_halflife_days INTEGER DEFAULT 7,   -- For time_decay model
    position_first_weight NUMERIC(3,2) DEFAULT 0.40,  -- For position_based model
    position_last_weight NUMERIC(3,2) DEFAULT 0.40,
    lookback_window_days INTEGER DEFAULT 30,       -- Touchpoints older than this are ignored
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default config
INSERT INTO attribution_config (model_type) VALUES ('last_touch')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Enhance attribution_touchpoints with more data
-- ─────────────────────────────────────────────
ALTER TABLE attribution_touchpoints
    ADD COLUMN IF NOT EXISTS fbc TEXT,              -- Facebook click ID (from cookie _fbc)
    ADD COLUMN IF NOT EXISTS fbp TEXT,              -- Facebook browser ID (from cookie _fbp)
    ADD COLUMN IF NOT EXISTS gclid TEXT,            -- Google Click ID
    ADD COLUMN IF NOT EXISTS event_source_url TEXT, -- Landing page URL
    ADD COLUMN IF NOT EXISTS attributed_revenue NUMERIC(12,2) DEFAULT 0, -- Revenue attributed to this touchpoint
    ADD COLUMN IF NOT EXISTS attribution_weight NUMERIC(5,4) DEFAULT 0;  -- Weight in attribution model (0.0000-1.0000)

-- ─────────────────────────────────────────────
-- 3. Server-Side Conversion Event Log
-- Tracks events sent to Meta CAPI and Google Ads
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversion_events (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
    event_name TEXT NOT NULL,                       -- 'Purchase', 'Lead', 'AddToCart', etc.
    event_id TEXT NOT NULL UNIQUE,                  -- Dedup key (shared with browser pixel)
    order_id INTEGER REFERENCES orders(id),
    customer_id UUID REFERENCES customers(id),
    attribution_id UUID REFERENCES attributions(id),

    -- Event data
    event_value NUMERIC(12,2),
    currency CHAR(3) DEFAULT 'MXN',
    event_source_url TEXT,

    -- Platform-specific IDs
    fbc TEXT,                                       -- Meta: _fbc cookie value
    fbp TEXT,                                       -- Meta: _fbp cookie value
    gclid TEXT,                                     -- Google: click ID
    pixel_id TEXT,                                  -- Meta pixel ID used

    -- Delivery status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'duplicate')),
    platform_response JSONB,                        -- Raw response from the API
    retry_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversion_events_status ON conversion_events(status) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_conversion_events_order ON conversion_events(order_id);
CREATE INDEX idx_conversion_events_platform ON conversion_events(platform, event_name);
CREATE INDEX idx_conversion_events_created ON conversion_events(created_at DESC);

-- ─────────────────────────────────────────────
-- 4. Add revenue tracking to attributions
-- ─────────────────────────────────────────────
ALTER TABLE attributions
    ADD COLUMN IF NOT EXISTS attributed_revenue NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attribution_model TEXT,
    ADD COLUMN IF NOT EXISTS attribution_weight NUMERIC(5,4) DEFAULT 1.0;
