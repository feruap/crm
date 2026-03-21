-- Migration 001: Phase 1 — Foundations
-- Adds: order sync log, attribution touchpoints, campaign-product mappings
-- Date: 2026-03-19

-- ─────────────────────────────────────────────
-- 1. Order Sync Log
-- Tracks bidirectional sync events between CRM and WooCommerce
-- Prevents infinite loops via source tracking
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_sync_log (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    external_order_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('crm', 'woocommerce')),
    sync_direction TEXT NOT NULL CHECK (sync_direction IN ('crm_to_wc', 'wc_to_crm')),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error TEXT  -- NULL = success
);

CREATE INDEX idx_order_sync_log_order ON order_sync_log(order_id);
CREATE INDEX idx_order_sync_log_external ON order_sync_log(external_order_id);
CREATE INDEX idx_order_sync_log_time ON order_sync_log(synced_at DESC);

-- ─────────────────────────────────────────────
-- 2. Attribution Touchpoints
-- Records EVERY customer interaction across channels
-- Supports multi-touch attribution models
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attribution_touchpoints (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id),
    channel TEXT,                           -- 'whatsapp', 'facebook', 'instagram', 'web', 'google'
    touchpoint_type TEXT,                   -- 'ad_click', 'organic', 'direct', 'referral'
    ad_id TEXT,
    ad_set_id TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    gclid TEXT,
    fbclid TEXT,
    raw_referral JSONB,                    -- Full referral data from Meta webhook
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_touchpoints_customer ON attribution_touchpoints(customer_id);
CREATE INDEX idx_touchpoints_campaign ON attribution_touchpoints(campaign_id);
CREATE INDEX idx_touchpoints_created ON attribution_touchpoints(created_at DESC);

-- ─────────────────────────────────────────────
-- 3. Campaign-Product Mappings
-- Links campaigns to products with auto-response content
-- Used by the campaign responder to send targeted messages
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_product_mappings (
    id SERIAL PRIMARY KEY,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    wc_product_id INTEGER,                 -- WooCommerce product ID
    product_name TEXT NOT NULL,
    welcome_message TEXT NOT NULL,          -- Auto-response message text
    media_urls JSONB DEFAULT '[]',         -- Array of URLs: images, PDFs, videos
    auto_send BOOLEAN DEFAULT TRUE,        -- Whether to auto-send on campaign match
    priority INTEGER DEFAULT 0,            -- Higher = sent first if multiple matches
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cpm_campaign ON campaign_product_mappings(campaign_id);
CREATE INDEX idx_cpm_active ON campaign_product_mappings(is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────
-- 4. Add referral_data to conversations
-- Stores the Meta referral object (ad_id, source, etc.)
-- ─────────────────────────────────────────────
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS referral_data JSONB,
    ADD COLUMN IF NOT EXISTS utm_data JSONB;

-- ─────────────────────────────────────────────
-- 5. Add bot_action to messages
-- Categorizes automated messages for reporting
-- ─────────────────────────────────────────────
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS bot_action TEXT;
-- Values: 'campaign_auto_reply', 'knowledge_base', 'ai_generated', 'flow_response'
