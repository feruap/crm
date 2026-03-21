-- Migration 010: Add 'webchat' to identity_provider enum
-- Required for the webchat/livechat channel

ALTER TYPE identity_provider ADD VALUE IF NOT EXISTS 'webchat';
