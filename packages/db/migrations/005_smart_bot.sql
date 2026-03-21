-- Smart Bot Engine Schema
-- Adds conversation state tracking, lead scoring, and bot interaction logging

-- ─────────────────────────────────────────────
-- Enum for bot modes
-- ─────────────────────────────────────────────

CREATE TYPE bot_mode AS ENUM (
    'campaign_response',
    'qualification',
    'medical_advisory',
    'human_handoff',
    'idle'
);

-- ─────────────────────────────────────────────
-- Add columns to existing conversations table
-- ─────────────────────────────────────────────

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS bot_mode bot_mode DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS qualification_step VARCHAR,
    ADD COLUMN IF NOT EXISTS referral_data JSONB,
    ADD COLUMN IF NOT EXISTS utm_data JSONB,
    ADD COLUMN IF NOT EXISTS bot_interaction_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_bot_interaction_at TIMESTAMP WITH TIME ZONE;

-- ─────────────────────────────────────────────
-- Add columns to customer_profiles table
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
    business_type VARCHAR,                -- laboratorio, farmacia, consultorio, hospital, clinica, distribuidor, particular
    specialty VARCHAR,                     -- medicina_general, pediatria, ginecologia, urgencias, laboratorio_clinico, etc
    estimated_monthly_volume VARCHAR,      -- bajo_1_50, medio_51_200, alto_201_1000, mayoreo_1000_plus
    professional_title VARCHAR,            -- Dr., QFB, Lic., Ing., etc
    organization_name TEXT,
    detected_interests TEXT[],             -- array of interest categories
    lead_score INT DEFAULT 0,              -- calculated from qualification data
    qualification_data JSONB,              -- stores answer to qualification questions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_customer ON customer_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_lead_score ON customer_profiles(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_business_type ON customer_profiles(business_type);

-- ─────────────────────────────────────────────
-- Conversation State Tracking
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE UNIQUE,
    current_step VARCHAR,                  -- tracks current qualification step or bot state
    step_data JSONB,                       -- stores step-specific context
    bot_confidence FLOAT,                  -- overall confidence for current conversation
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_state_conv ON conversation_state(conversation_id);

-- ─────────────────────────────────────────────
-- Lead Scoring
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    professional_score INT DEFAULT 0,      -- +30 if is_professional=true
    volume_score INT DEFAULT 0,            -- +20 based on estimated volume
    specialty_match_score INT DEFAULT 0,   -- +15 if specialty matches product
    engagement_score INT DEFAULT 0,        -- +10 for each message exchange
    total_score INT DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_customer ON lead_scores(customer_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_conversation ON lead_scores(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_total ON lead_scores(total_score DESC);

-- ─────────────────────────────────────────────
-- Bot Interactions Logging
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    interaction_type VARCHAR NOT NULL,     -- 'campaign_response', 'qualification_q', 'medical_advisory', 'routing', 'escalation'
    intent_classification VARCHAR,         -- CAMPAIGN_RESPONSE, QUALIFICATION, MEDICAL_INQUIRY, PRICE_REQUEST, ORDER_STATUS, COMPLAINT, HUMAN_NEEDED
    confidence FLOAT,
    action_taken VARCHAR,                  -- what the bot actually did
    result JSONB,                          -- outcome data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_interactions_conversation ON bot_interactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bot_interactions_customer ON bot_interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_bot_interactions_type ON bot_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_bot_interactions_created ON bot_interactions(created_at DESC);

-- ─────────────────────────────────────────────
-- Clinical Decision Rules (for mapping symptoms/conditions to products)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical_decision_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    trigger_keywords TEXT[],               -- keywords that match this rule
    recommended_product_ids INT[],         -- product IDs to recommend
    recommendation_reason TEXT,            -- why these products
    client_profile_filter VARCHAR[],       -- filter by business type (empty = all)
    complementary_product_ids INT[],       -- cross-sell suggestions
    priority INT DEFAULT 50,               -- higher priority rules evaluated first
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_rules_active ON clinical_decision_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clinical_rules_priority ON clinical_decision_rules(priority DESC);

-- ─────────────────────────────────────────────
-- Medical Knowledge Chunks (for RAG)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS medical_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medical_product_id INT,                -- FK to medical_products table
    chunk_type VARCHAR,                    -- 'clinical_info', 'procedure', 'interpretation', 'storage', 'regulatory'
    content TEXT NOT NULL,
    embedding VECTOR(1536),                -- semantic embedding for similarity search
    confidence_score FLOAT DEFAULT 0.9,
    source TEXT,                           -- 'technical_sheet', 'clinical_guideline', 'faq', 'training'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_product ON medical_knowledge_chunks(medical_product_id);
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_type ON medical_knowledge_chunks(chunk_type);

-- ─────────────────────────────────────────────
-- Campaign Product Mappings (for auto-reply on ad clicks)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_product_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    wc_product_id INT,                    -- WooCommerce product ID
    product_name VARCHAR,                  -- Human-readable product name
    welcome_message TEXT,                  -- Auto-reply text
    media_urls TEXT[],                    -- Images/videos to attach
    auto_send BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 50,               -- if multiple products per campaign
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, wc_product_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_product_campaign ON campaign_product_mappings(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_product_active ON campaign_product_mappings(is_active) WHERE is_active = TRUE;
