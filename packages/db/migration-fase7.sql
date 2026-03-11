-- ─────────────────────────────────────────────
-- FASE 7 MIGRATION — Simulador Persistente, Grupos de Agentes, Flujos Visuales
-- Run this against an existing MyAlice database to add the new features.
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

-- Done!
SELECT 'Fase 7 migration completed successfully' AS status;
