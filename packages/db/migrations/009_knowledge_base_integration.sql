-- Migration 009: Knowledge Base Integration
-- Extends medical_products with full KB data (médico + laboratorio audiences)
-- Adds knowledge_gaps for tracking unanswered questions
-- Adds wc_price_sync_log for WC↔CRM price synchronization
-- Date: 2026-03-22

-- ─────────────────────────────────────────────
-- 1. Extend medical_products with KB fields
-- ─────────────────────────────────────────────

-- Product identity
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS tipo_producto TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS url_tienda TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS marca TEXT DEFAULT 'Amunet';

-- Pricing (WC is source of truth, synced periodically)
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS precio_publico DECIMAL(10,2);
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS precio_por_prueba DECIMAL(10,2);
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS precio_sugerido_paciente TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS margen_estimado TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS presentaciones JSONB DEFAULT '[]'::jsonb;

-- Technical details (extend existing)
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS analito TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS volumen_muestra TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS punto_corte TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS registro_sanitario TEXT;

-- Clinical use (detailed)
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS clasificacion_clinica TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS proposito_clinico TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS especialidades TEXT[] DEFAULT '{}';
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS escenarios_uso TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS perfil_paciente TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS frecuencia_uso TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS limitaciones TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS resultado_positivo TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS resultado_negativo TEXT;

-- Dual-audience sales content
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS pitch_medico TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS pitch_laboratorio TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS ventaja_vs_lab TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS roi_medico TEXT;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS objeciones_medico JSONB DEFAULT '[]'::jsonb;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS objeciones_laboratorio JSONB DEFAULT '[]'::jsonb;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS porque_agregarlo_lab TEXT;

-- Cross-sells and up-sells (structured)
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS cross_sells JSONB DEFAULT '[]'::jsonb;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS up_sells JSONB DEFAULT '[]'::jsonb;

-- Search & classification
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS palabras_clave TEXT[] DEFAULT '{}';
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS target_audience TEXT[] DEFAULT '{medico,laboratorio}';

-- WC sync tracking
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS wc_last_sync TIMESTAMP WITH TIME ZONE;
ALTER TABLE medical_products ADD COLUMN IF NOT EXISTS wc_variation_ids INTEGER[] DEFAULT '{}';

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_medical_products_audience ON medical_products USING GIN(target_audience);
CREATE INDEX IF NOT EXISTS idx_medical_products_keywords ON medical_products USING GIN(palabras_clave);
CREATE INDEX IF NOT EXISTS idx_medical_products_url ON medical_products(url_tienda);

-- ─────────────────────────────────────────────
-- 2. Knowledge Gaps — tracks unanswered questions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_gaps (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    conversation_id UUID,
    detected_product_id INTEGER REFERENCES medical_products(id) ON DELETE SET NULL,
    category TEXT,                          -- auto-detected category of the question
    frequency INTEGER DEFAULT 1,           -- how many times this question was asked
    status TEXT DEFAULT 'pending',          -- 'pending', 'in_review', 'resolved', 'dismissed'
    admin_notes TEXT,
    resolved_answer TEXT,                   -- the answer once admin provides it
    resolved_by TEXT,                       -- admin user who resolved it
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_status ON knowledge_gaps(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_product ON knowledge_gaps(detected_product_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_frequency ON knowledge_gaps(frequency DESC);

-- ─────────────────────────────────────────────
-- 3. WC Price Sync Log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wc_price_sync_log (
    id SERIAL PRIMARY KEY,
    medical_product_id INTEGER REFERENCES medical_products(id) ON DELETE CASCADE,
    wc_product_id INTEGER NOT NULL,
    field_changed TEXT NOT NULL,           -- 'precio_publico', 'presentaciones', etc.
    old_value TEXT,
    new_value TEXT,
    sync_direction TEXT DEFAULT 'wc_to_crm',  -- 'wc_to_crm' or 'crm_to_wc'
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wc_sync_log_product ON wc_price_sync_log(medical_product_id);
CREATE INDEX IF NOT EXISTS idx_wc_sync_log_date ON wc_price_sync_log(synced_at DESC);
