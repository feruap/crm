-- WooCommerce Integration Engine Tables
-- Phase 6: Commission Tracking, Attribution Chain, Kanban State Cache

-- ─────────────────────────────────────────────
-- Commission Tracking per Conversation
-- Gap #7: Records which agent handled the conversation leading to a sale
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_commissions (
    id SERIAL PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    order_id VARCHAR(64),
    order_total DECIMAL(12,2),
    commission_rate DECIMAL(5,4) DEFAULT 0.10,  -- 10% default
    commission_amount DECIMAL(12,2),
    sk_commission_id VARCHAR(64),  -- SalesKing reference for integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, order_id)
);

CREATE INDEX idx_conversation_commissions_agent ON conversation_commissions(agent_id);
CREATE INDEX idx_conversation_commissions_order ON conversation_commissions(order_id);
CREATE INDEX idx_conversation_commissions_created ON conversation_commissions(created_at);

-- ─────────────────────────────────────────────
-- Attribution Chain: Ad → Conversation → Order
-- Gap #10: Complete tracking from ad spend to attributed revenue
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attribution_chain (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    conversation_id UUID REFERENCES conversations(id),
    order_id VARCHAR(64),
    ad_platform VARCHAR(20) CHECK (ad_platform IN ('facebook', 'instagram', 'google', 'tiktok')),
    campaign_id VARCHAR(128),
    ad_id VARCHAR(128),
    touchpoint_data JSONB DEFAULT '{}',
    order_total DECIMAL(12,2),
    attribution_model VARCHAR(20) DEFAULT 'last_touch',
    attributed_revenue DECIMAL(12,2),
    meta_capi_sent BOOLEAN DEFAULT FALSE,
    google_ads_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attribution_chain_customer ON attribution_chain(customer_id);
CREATE INDEX idx_attribution_chain_conversation ON attribution_chain(conversation_id);
CREATE INDEX idx_attribution_chain_order ON attribution_chain(order_id);
CREATE INDEX idx_attribution_chain_platform ON attribution_chain(ad_platform);
CREATE INDEX idx_attribution_chain_created ON attribution_chain(created_at);

-- ─────────────────────────────────────────────
-- Kanban State Cache: Synced from WooCommerce
-- Gap #9: Order status mapping to Kanban columns
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_state_cache (
    order_id VARCHAR(64) PRIMARY KEY,
    wc_status VARCHAR(30),
    kanban_column VARCHAR(50),
    last_moved_by UUID REFERENCES agents(id),
    last_moved_at TIMESTAMP WITH TIME ZONE,
    allowed_transitions JSONB DEFAULT '[]',
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kanban_state_wc_status ON kanban_state_cache(wc_status);
CREATE INDEX idx_kanban_state_column ON kanban_state_cache(kanban_column);

-- ─────────────────────────────────────────────
-- Discount Requests
-- Gap #8: Track discount approval workflow
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discount_requests (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    order_id VARCHAR(64),
    agent_id UUID REFERENCES agents(id),
    discount_percent DECIMAL(5,2),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
    reviewed_by UUID REFERENCES agents(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, agent_id, created_at)
);

CREATE INDEX idx_discount_requests_status ON discount_requests(status);
CREATE INDEX idx_discount_requests_agent ON discount_requests(agent_id);
CREATE INDEX idx_discount_requests_created ON discount_requests(created_at);

-- ─────────────────────────────────────────────
-- Alter existing tables to support new gaps
-- ─────────────────────────────────────────────

-- Add columns to conversation_state for purchase context (Gap #5)
ALTER TABLE conversation_state
ADD COLUMN IF NOT EXISTS purchase_context JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reorder_candidate BOOLEAN DEFAULT FALSE;

-- Add columns to orders for bot-triggered creation (Gap #6)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS created_by_bot BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bot_conversation_id UUID REFERENCES conversations(id);

-- Ensure order_sync_log has columns for discount tracking
ALTER TABLE order_sync_log
ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{}';

-- ─────────────────────────────────────────────
-- Grants for proper access control
-- ─────────────────────────────────────────────

-- Allow agents to view commissions and attributions
GRANT SELECT ON conversation_commissions TO public;
GRANT SELECT ON attribution_chain TO public;
GRANT SELECT ON kanban_state_cache TO public;
GRANT SELECT ON discount_requests TO public;

-- Allow agents to insert commissions and requests
GRANT INSERT ON conversation_commissions TO public;
GRANT INSERT ON discount_requests TO public;

-- ─────────────────────────────────────────────
-- Sequence updates for auto-increment IDs
-- ─────────────────────────────────────────────

ALTER SEQUENCE conversation_commissions_id_seq OWNED BY conversation_commissions.id;
ALTER SEQUENCE attribution_chain_id_seq OWNED BY attribution_chain.id;
ALTER SEQUENCE discount_requests_id_seq OWNED BY discount_requests.id;
