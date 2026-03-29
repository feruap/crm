-- Migration 007: Performance Indexes
-- Partial and composite indexes for high-traffic queries

CREATE INDEX IF NOT EXISTS idx_conversations_agent_status
    ON conversations (assigned_agent_id, status)
    WHERE status IN ('open', 'pending');

CREATE INDEX IF NOT EXISTS idx_messages_unread
    ON messages (conversation_id, is_read, direction)
    WHERE is_read = FALSE AND direction = 'inbound';

CREATE INDEX IF NOT EXISTS idx_messages_conv_direction
    ON messages (conversation_id, direction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
    ON scheduled_messages (scheduled_at)
    WHERE status = 'pending';
