-- 009: Widget configs table for LeadClick embed widget
CREATE TABLE IF NOT EXISTS widget_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Mi Widget',
    channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    bg_color TEXT NOT NULL DEFAULT '#5A59D5',
    text_color TEXT NOT NULL DEFAULT '#FFFFFF',
    welcome_text TEXT NOT NULL DEFAULT '¿Cómo podemos ayudarte?',
    position TEXT NOT NULL DEFAULT 'right' CHECK (position IN ('left', 'right')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    embed_code_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default widget config
INSERT INTO widget_configs (name, welcome_text, is_active)
VALUES ('Widget Principal', '¡Hola! ¿Cómo podemos ayudarte hoy?', TRUE)
ON CONFLICT DO NOTHING;
