-- Migration 007: WhatsApp Channel Configuration
-- Creates the WhatsApp channel record in the channels table
-- so the webhook handler can find it and process incoming messages.
--
-- The webhook handler does:
--   SELECT id, webhook_secret FROM channels
--   WHERE provider = 'whatsapp' AND is_active = TRUE LIMIT 1
--
-- Without this record, ALL incoming WhatsApp messages are silently dropped.

INSERT INTO channels (name, provider, provider_config, webhook_secret, is_active)
VALUES (
    'WhatsApp Amunet',
    'whatsapp',
    jsonb_build_object(
        'phone_number_id', '956844914189695',
        'waba_id', '1521810052698130',
        'phone_number', '+13468611165',
        'app_id', '1452652589836082'
    ),
    'f4e61d3b5283430322ed01ffa2828f5e',  -- META_APP_SECRET for HMAC signature validation
    TRUE
)
ON CONFLICT DO NOTHING;

-- Note: The access_token is NOT stored in provider_config because it's
-- sensitive and should come from the environment variable or a secure vault.
-- The message-sender.ts service reads it from provider_config OR falls back
-- to process.env.WHATSAPP_ACCESS_TOKEN.
