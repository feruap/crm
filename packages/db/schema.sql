-- MyAlice Clone Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

-- Channels where customers communicate
CREATE TYPE identity_provider AS ENUM ('whatsapp', 'facebook', 'instagram', 'woocommerce', 'webchat');

-- Ad platforms that originate traffic (separate from communication channels)
CREATE TYPE ad_platform AS ENUM ('facebook', 'instagram', 'tiktok', 'google');

CREATE TYPE ai_provider_type AS ENUM ('deepseek', 'z_ai', 'claude', 'gemini');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'resolved', 'snoozed');
CREATE TYPE message_handler AS ENUM ('human', 'bot');

-- ─────────────────────────────────────────────
-- 1. Agents (human operators)
-- ─────────────────────────────────────────────
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'supervisor', 'agent')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. Universal Customer Profiles
-- ─────────────────────────────────────────────
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 3. External Identity Mapping
-- Maps multiple channel identities to one Customer
-- ─────────────────────────────────────────────
CREATE TABLE external_identities (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    provider identity_provider NOT NULL,
    provider_id TEXT NOT NULL, -- e.g., phone number, PSID, WooCommerce user_id
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);

-- ─────────────────────────────────────────────
-- 4. Conversation Channels
-- ─────────────────────────────────────────────
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider identity_provider NOT NULL,
    provider_config JSONB,  -- Page ID, Access Tokens, App Secrets (encrypt at app level)
    webhook_secret TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sync_comments BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. Ad Campaigns
-- Tracks campaigns across FB, IG, TikTok, Google Ads
-- ─────────────────────────────────────────────
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform ad_platform NOT NULL,
    platform_campaign_id TEXT NOT NULL,  -- ID from the ad platform
    platform_ad_set_id TEXT,             -- Ad set / ad group level
    platform_ad_id TEXT,                 -- Individual ad level
    name TEXT,
    metadata JSONB,                      -- Raw data from platform API
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, platform_campaign_id)
);

-- ─────────────────────────────────────────────
-- 6. Conversations (threads)
-- ─────────────────────────────────────────────
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    channel_id UUID REFERENCES channels(id),
    assigned_agent_id UUID REFERENCES agents(id),
    status conversation_status DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 7. Attributions
-- Links a customer/conversation/order to the campaign that originated it.
-- Synced back to WooCommerce as order metadata.
-- ─────────────────────────────────────────────
CREATE TABLE attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    campaign_id UUID REFERENCES campaigns(id),
    conversation_id UUID REFERENCES conversations(id),
    order_id INT REFERENCES orders(id),          -- Populated when customer converts
    woocommerce_order_id TEXT,                    -- WC order reference for the sync
    woocommerce_synced BOOLEAN DEFAULT FALSE,     -- TRUE once pushed to WooCommerce REST API
    woocommerce_synced_at TIMESTAMP WITH TIME ZONE,
    attributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 8. Messages
-- ─────────────────────────────────────────────
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id),
    customer_id UUID REFERENCES customers(id),
    direction message_direction NOT NULL,
    content TEXT,
    media_url TEXT,
    message_type TEXT DEFAULT 'text',     -- text, image, file, template
    provider_message_id TEXT,             -- Original ID from Meta/WhatsApp
    handled_by message_handler,           -- NULL = pending, 'bot' or 'human'
    bot_confidence FLOAT,                 -- 0.0-1.0, confidence score when bot handled
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 9. Customer Attributes
-- ─────────────────────────────────────────────
CREATE TABLE customer_attributes (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    key TEXT NOT NULL,
    value TEXT,
    attribute_type TEXT DEFAULT 'string',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, key)
);

-- ─────────────────────────────────────────────
-- 10. Orders (WooCommerce Sync)
-- ─────────────────────────────────────────────
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    external_order_id TEXT NOT NULL UNIQUE,  -- Prevents duplicate WooCommerce imports
    total_amount DECIMAL(10, 2),
    currency CHAR(3),
    status TEXT,
    items JSONB,
    order_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 11. AI Provider Configurations
-- ─────────────────────────────────────────────
CREATE TABLE ai_settings (
    id SERIAL PRIMARY KEY,
    provider ai_provider_type NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    model_name TEXT,   -- e.g., 'deepseek-chat', 'gemini-1.5-pro'
    is_default BOOLEAN DEFAULT FALSE,
    system_prompt TEXT,
    temperature FLOAT DEFAULT 0.7,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 12. Knowledge Base (Bot Learning)
-- Populated automatically from resolved conversations.
-- Used for semantic search when the bot handles new messages.
-- ─────────────────────────────────────────────
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,               -- Extracted question from the conversation
    answer TEXT NOT NULL,                 -- Validated answer given by a human agent
    source_conversation_id UUID REFERENCES conversations(id),
    embedding VECTOR(1536),               -- Semantic embedding for similarity search
    confidence_score FLOAT DEFAULT 1.0,  -- Decreases if bot answer gets corrected
    use_count INT DEFAULT 0,             -- Times this entry has been used by the bot
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 13. AI Recommendations & Sentiment
-- ─────────────────────────────────────────────
CREATE TABLE ai_insights (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    conversation_id UUID REFERENCES conversations(id),
    last_sentiment TEXT,           -- positive, neutral, negative
    suggested_next_action TEXT,
    summary_short TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX idx_identities_customer ON external_identities(customer_id);

CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_channel ON conversations(channel_id);
CREATE INDEX idx_conversations_agent ON conversations(assigned_agent_id);
CREATE INDEX idx_conversations_status ON conversations(status);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_customer ON messages(customer_id);
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_handled_by ON messages(handled_by);

CREATE INDEX idx_orders_customer ON orders(customer_id);

CREATE INDEX idx_campaigns_platform ON campaigns(platform);

CREATE INDEX idx_attributions_customer ON attributions(customer_id);
CREATE INDEX idx_attributions_campaign ON attributions(campaign_id);
CREATE INDEX idx_attributions_order ON attributions(order_id);
CREATE INDEX idx_attributions_wc_synced ON attributions(woocommerce_synced) WHERE woocommerce_synced = FALSE;

CREATE INDEX idx_knowledge_base_confidence ON knowledge_base(confidence_score);
CREATE INDEX idx_knowledge_base_use_count ON knowledge_base(use_count);
