-- Migration 003: Phase 3 — Intelligent Handoff & Purchase History Flows
-- Adds: escalation rules, handoff summaries, customer segments, reorder tracking
-- Date: 2026-03-19

-- ─────────────────────────────────────────────
-- 1. Escalation Rules
-- Contextual rules for when to transfer from bot to human
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escalation_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    condition_type TEXT NOT NULL CHECK (condition_type IN (
        'keyword_match', 'sentiment_negative', 'purchase_intent',
        'discount_request', 'vip_customer', 'complaint',
        'technical_question', 'order_issue', 'explicit_request'
    )),
    condition_config JSONB NOT NULL DEFAULT '{}',
    -- keyword_match: { "keywords": ["descuento", "precio especial"] }
    -- vip_customer: { "min_lifetime_spend": 50000 }
    -- sentiment_negative: { "threshold": -0.5 }
    -- purchase_intent: { "keywords": ["quiero comprar", "cotización", "pedido"] }

    target_type TEXT NOT NULL DEFAULT 'agent_group' CHECK (target_type IN (
        'agent_group', 'specific_agent', 'supervisor', 'any_available'
    )),
    target_id UUID,                              -- agent_id or group_id depending on target_type
    target_role TEXT,                             -- 'admin', 'supervisor', 'agent' — filter by role

    priority INTEGER DEFAULT 0,                  -- Higher = evaluated first
    generate_summary BOOLEAN DEFAULT TRUE,       -- Generate AI summary for handoff
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_escalation_rules_active ON escalation_rules(is_active, priority DESC);

-- ─────────────────────────────────────────────
-- 2. Handoff Events
-- Records every bot→human transfer with context
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS handoff_events (
    id SERIAL PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    from_handler TEXT NOT NULL DEFAULT 'bot',     -- 'bot' or agent_id
    to_agent_id UUID REFERENCES agents(id),
    escalation_rule_id INTEGER REFERENCES escalation_rules(id),
    trigger_reason TEXT,                          -- Why the handoff happened
    ai_summary TEXT,                              -- AI-generated context for the agent
    customer_profile_snapshot JSONB,              -- Snapshot of customer profile at handoff time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_handoff_conversation ON handoff_events(conversation_id);
CREATE INDEX idx_handoff_agent ON handoff_events(to_agent_id);
CREATE INDEX idx_handoff_time ON handoff_events(created_at DESC);

-- ─────────────────────────────────────────────
-- 3. Customer Segments
-- Automatically computed segments for targeting
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_segments (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    segment_type TEXT NOT NULL CHECK (segment_type IN (
        'purchase_frequency', 'business_type', 'product_category',
        'value_tier', 'lifecycle_stage', 'reorder_due'
    )),
    segment_value TEXT NOT NULL,
    -- purchase_frequency: 'monthly', 'quarterly', 'biannual', 'annual', 'one_time'
    -- value_tier: 'vip', 'high', 'medium', 'low', 'prospect'
    -- lifecycle_stage: 'new', 'active', 'at_risk', 'dormant', 'churned'
    -- reorder_due: 'overdue', 'due_soon', 'not_due'

    metadata JSONB DEFAULT '{}',
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, segment_type)
);

CREATE INDEX idx_segments_customer ON customer_segments(customer_id);
CREATE INDEX idx_segments_type_value ON customer_segments(segment_type, segment_value);

-- ─────────────────────────────────────────────
-- 4. Add handoff context to conversations
-- ─────────────────────────────────────────────
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS handoff_summary TEXT,
    ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
