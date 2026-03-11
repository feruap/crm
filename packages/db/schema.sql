-- MyAlice Clone Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;


-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

-- Channels where customers communicate
CREATE TYPE identity_provider AS ENUM ('whatsapp', 'facebook', 'instagram', 'tiktok', 'woocommerce');

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
    salesking_agent_code TEXT,          -- SalesKing agentid (user meta key: salesking_agentid)
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
-- 7. Orders (WooCommerce Sync)
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
-- 8. Attributions
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
    gclid TEXT,                                   -- Google Click ID captured from landing page UTM
    google_ads_synced BOOLEAN DEFAULT FALSE,      -- TRUE once conversion sent to Google Ads API
    google_ads_synced_at TIMESTAMP WITH TIME ZONE,
    attributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 9. Messages
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
-- 10. Customer Attributes
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
CREATE INDEX idx_conversations_channel ON channels(id);
CREATE INDEX idx_conversations_agent ON agents(id);
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
CREATE INDEX idx_attributions_google_synced ON attributions(google_ads_synced) WHERE google_ads_synced = FALSE;

CREATE INDEX idx_knowledge_base_confidence ON knowledge_base(confidence_score);
CREATE INDEX idx_knowledge_base_use_count ON knowledge_base(use_count);

-- ─────────────────────────────────────────────
-- 14. Teams
-- ─────────────────────────────────────────────
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE team_members (
    team_id  UUID REFERENCES teams(id)  ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, agent_id)
);

-- ─────────────────────────────────────────────
-- 15. Bot Automation Flows
-- ─────────────────────────────────────────────
CREATE TABLE bot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword','first_message','campaign','after_hours')),
    trigger_config JSONB DEFAULT '{}',
    steps JSONB NOT NULL DEFAULT '[]',
    channel_providers TEXT[],
    priority INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 16. Business Hours
-- ─────────────────────────────────────────────
CREATE TABLE business_hours (
    id SERIAL PRIMARY KEY,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_open BOOLEAN DEFAULT TRUE,
    open_time  TIME DEFAULT '09:00',
    close_time TIME DEFAULT '18:00',
    UNIQUE(day_of_week)
);
INSERT INTO business_hours (day_of_week, is_open, open_time, close_time) VALUES
    (0, FALSE, '09:00', '18:00'),
    (1, TRUE,  '09:00', '18:00'),
    (2, TRUE,  '09:00', '18:00'),
    (3, TRUE,  '09:00', '18:00'),
    (4, TRUE,  '09:00', '18:00'),
    (5, TRUE,  '09:00', '18:00'),
    (6, FALSE, '09:00', '18:00');

CREATE TABLE business_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO business_settings (key, value) VALUES
    ('timezone',           'America/Mexico_City'),
    ('after_hours_message','Gracias por escribirnos. Nuestro horario es lun-vie 9am-6pm. Te respondemos pronto 🙏'),
    ('auto_reply_enabled', 'true');

-- ─────────────────────────────────────────────
-- MIGRATION (run if DB already exists)
-- ─────────────────────────────────────────────
-- CREATE TABLE teams (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, color TEXT DEFAULT '#6366f1', created_at TIMESTAMPTZ DEFAULT NOW());
-- CREATE TABLE team_members (team_id UUID REFERENCES teams(id) ON DELETE CASCADE, agent_id UUID REFERENCES agents(id) ON DELETE CASCADE, PRIMARY KEY (team_id, agent_id));
-- CREATE TABLE bot_flows (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, is_active BOOLEAN DEFAULT TRUE, trigger_type TEXT NOT NULL, trigger_config JSONB DEFAULT '{}', steps JSONB NOT NULL DEFAULT '[]', channel_providers TEXT[], priority INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
-- CREATE TABLE business_hours (id SERIAL PRIMARY KEY, day_of_week INT NOT NULL UNIQUE, is_open BOOLEAN DEFAULT TRUE, open_time TIME DEFAULT '09:00', close_time TIME DEFAULT '18:00');
-- CREATE TABLE business_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- ALTER TABLE agents ADD COLUMN IF NOT EXISTS salesking_agent_code TEXT;
-- ALTER TYPE identity_provider ADD VALUE IF NOT EXISTS 'tiktok';
-- ALTER TABLE attributions ADD COLUMN IF NOT EXISTS gclid TEXT;
-- ALTER TABLE attributions ADD COLUMN IF NOT EXISTS google_ads_synced BOOLEAN DEFAULT FALSE;
-- ALTER TABLE attributions ADD COLUMN IF NOT EXISTS google_ads_synced_at TIMESTAMP WITH TIME ZONE;

-- ─────────────────────────────────────────────
-- FASE 1 MIGRATIONS
-- ─────────────────────────────────────────────

-- Agregar campos a conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conversation_label TEXT;

-- Quick Replies (Respuestas Rápidas)
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,  -- NULL = global
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,    -- NULL = no es de equipo
    scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','team','global')),
    shortcut TEXT NOT NULL,          -- la palabra clave sin el /
    title TEXT,                      -- título opcional para identificar
    content TEXT NOT NULL,           -- el mensaje completo
    has_attachment BOOLEAN DEFAULT FALSE,
    attachment_url TEXT,
    use_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quick_replies_agent ON quick_replies(agent_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_scope ON quick_replies(scope);

-- Scheduled Messages (Programar mensaje)
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    channel_id UUID REFERENCES channels(id),
    content TEXT NOT NULL,
    media_url TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status, scheduled_at)
    WHERE status = 'pending';

-- Events / Agenda
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    agent_id UUID REFERENCES agents(id),
    customer_id UUID REFERENCES customers(id),
    conversation_id UUID REFERENCES conversations(id),
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    all_day BOOLEAN DEFAULT FALSE,
    event_type TEXT DEFAULT 'meeting' CHECK (event_type IN ('meeting','call','demo','follow_up','other')),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id, start_at);
CREATE INDEX IF NOT EXISTS idx_events_customer ON events(customer_id);

-- Event Templates
CREATE TABLE IF NOT EXISTS event_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INT DEFAULT 60,
    event_type TEXT DEFAULT 'meeting',
    created_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- FASE 2 — Directorio y Productividad
-- ─────────────────────────────────────────────

-- Auto-asignación por funnel (kanban)
CREATE TABLE IF NOT EXISTS assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    channel_id UUID REFERENCES channels(id),         -- NULL = aplica a todos
    team_id UUID REFERENCES teams(id),               -- Asigna al equipo
    strategy TEXT DEFAULT 'round_robin' CHECK (strategy IN ('round_robin','least_busy','random')),
    is_active BOOLEAN DEFAULT TRUE,
    agent_ids UUID[] DEFAULT '{}',                   -- Agentes participantes en el round-robin
    current_index INT DEFAULT 0,                     -- Puntero para round-robin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stagnant lead tracking — agregar campo a conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_stage_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS stagnant_threshold_days INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_stagnant BOOLEAN DEFAULT FALSE;

-- Bulk message campaigns
CREATE TABLE IF NOT EXISTS bulk_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message_content TEXT NOT NULL,
    media_url TEXT,
    agent_id UUID REFERENCES agents(id),
    channel_id UUID REFERENCES channels(id),
    filter_criteria JSONB,          -- { label: 'Nuevo Cliente', tags: [...], stage: '...' }
    recipient_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','completed','cancelled')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulk_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_campaign_id UUID REFERENCES bulk_campaigns(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    conversation_id UUID REFERENCES conversations(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_bulk_recipients_campaign ON bulk_campaign_recipients(bulk_campaign_id, status);

-- ─────────────────────────────────────────────
-- FASE 4 — Usuarios, Canales Subtipos, Atribución Dual
-- ─────────────────────────────────────────────

-- 4.1 Agent management extras
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 4.2 Channel subtypes
-- subtype: 'messenger' | 'feed' para facebook; 'chat' | 'comments' para instagram; NULL = genérico
ALTER TABLE channels ADD COLUMN IF NOT EXISTS subtype TEXT;
CREATE INDEX IF NOT EXISTS idx_channels_provider_subtype ON channels(provider, subtype);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel_subtype TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS source_post_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS source_comment_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_comment_id TEXT;

-- 4.3 Dual Attribution
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS deal_value DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS deal_currency CHAR(3) DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS deal_closed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deal_closed_by UUID REFERENCES agents(id);

ALTER TABLE attributions
  ADD COLUMN IF NOT EXISTS sale_source TEXT CHECK (sale_source IN ('woocommerce','salesking','manual','unknown')),
  ADD COLUMN IF NOT EXISTS sale_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS sale_currency CHAR(3);

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS daily_budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_spend DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS spend_currency CHAR(3) DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS spend_last_synced_at TIMESTAMP WITH TIME ZONE;

-- ─────────────────────────────────────────────
-- FASE 5 — Múltiples Embudos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#e2e8f0',
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pipeline_id, name)
);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pipeline_stage_id UUID REFERENCES pipeline_stages(id);

-- ─────────────────────────────────────────────
-- FASE 6 — Gasto diario por campaña (ROAS período-aware)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_daily_spend (
  id              SERIAL PRIMARY KEY,
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  spend_date      DATE NOT NULL,
  spend_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency        CHAR(3) DEFAULT 'MXN',
  synced_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, spend_date)
);
CREATE INDEX IF NOT EXISTS idx_cds_campaign_id ON campaign_daily_spend(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cds_date        ON campaign_daily_spend(spend_date);

-- ─────────────────────────────────────────────
-- FASE 7 — Simulador Persistente, Grupos de Agentes, Flujos Visuales
-- ─────────────────────────────────────────────

-- 7.1 Mark simulated conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;

-- 7.2 Simulator session persistence (one active session per agent)
CREATE TABLE IF NOT EXISTS simulator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    channel_id UUID REFERENCES channels(id),
    customer_name TEXT,
    customer_phone TEXT,
    campaign_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id)
);

-- 7.3 Agent Groups (for flow-based routing)
CREATE TABLE IF NOT EXISTS agent_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    channel_id UUID REFERENCES channels(id),
    strategy TEXT NOT NULL DEFAULT 'round_robin'
        CHECK (strategy IN ('round_robin', 'least_busy', 'random')),
    current_index INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_group_members (
    group_id UUID REFERENCES agent_groups(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, agent_id)
);

-- 7.4 Visual flow support in bot_flows
ALTER TABLE bot_flows
    ADD COLUMN IF NOT EXISTS flow_type TEXT DEFAULT 'simple',
    ADD COLUMN IF NOT EXISTS nodes JSONB,
    ADD COLUMN IF NOT EXISTS edges JSONB;
