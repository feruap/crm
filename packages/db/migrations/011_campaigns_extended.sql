-- Migration 011: Extended campaigns tables (bulk campaigns, daily spend, spend_currency)

-- Bulk campaigns table
CREATE TABLE IF NOT EXISTS bulk_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message_content TEXT NOT NULL,
    media_url TEXT,
    agent_id UUID REFERENCES agents(id),
    channel_id UUID REFERENCES channels(id),
    filter_criteria JSONB,
    recipient_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','completed','cancelled')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bulk campaign recipients
CREATE TABLE IF NOT EXISTS bulk_campaign_recipients (
    id SERIAL PRIMARY KEY,
    bulk_campaign_id UUID REFERENCES bulk_campaigns(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Campaign spend_currency column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS spend_currency CHAR(3) DEFAULT 'MXN';

-- Daily spend tracking for Google/Meta campaigns
CREATE TABLE IF NOT EXISTS campaign_daily_spend (
    id SERIAL PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    spend_date DATE NOT NULL,
    spend_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency CHAR(3) DEFAULT 'MXN',
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, spend_date)
);
CREATE INDEX IF NOT EXISTS idx_cds_campaign_id ON campaign_daily_spend(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cds_date ON campaign_daily_spend(spend_date);
