-- ─────────────────────────────────────────────
-- 015: Escalation UI Configuration
-- Adds UI-editable fields to escalation_rules and ai_settings
-- so configuration is managed through the CRM interface,
-- not hardcoded in the engine.
-- ─────────────────────────────────────────────

-- 1. Add escalation_message to escalation_rules
-- This is the message the bot sends to the customer when this rule triggers.
-- Supports {agent_type} placeholder which gets replaced at runtime.
ALTER TABLE escalation_rules
    ADD COLUMN IF NOT EXISTS escalation_message TEXT;

COMMENT ON COLUMN escalation_rules.escalation_message IS
    'Custom message sent to customer when this rule triggers. Use {agent_type} as placeholder for the agent role label.';

-- 2. Expand condition_type CHECK to include new types
-- Drop old constraint and recreate with additional types
ALTER TABLE escalation_rules DROP CONSTRAINT IF EXISTS escalation_rules_condition_type_check;
ALTER TABLE escalation_rules ADD CONSTRAINT escalation_rules_condition_type_check
    CHECK (condition_type IN (
        'keyword_match', 'sentiment_negative', 'purchase_intent',
        'discount_request', 'vip_customer', 'complaint',
        'technical_question', 'order_issue', 'explicit_request',
        'distribution_inquiry', 'reorder', 'price_request'
    ));

-- 3. Add prompt_additions to ai_settings for extra rules
-- These get appended to the system prompt at runtime.
ALTER TABLE ai_settings
    ADD COLUMN IF NOT EXISTS prompt_additions TEXT;

COMMENT ON COLUMN ai_settings.prompt_additions IS
    'Additional rules/instructions appended to the system prompt. Editable via Settings > IA.';
