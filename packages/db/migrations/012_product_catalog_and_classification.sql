-- Migration 012: Product Catalog Enhancement & Client Classification
-- Adds: commercial pricing fields to medical_products, client classification types
-- Date: 2026-03-22

-- ─────────────────────────────────────────────
-- 1. Add commercial/pricing fields to medical_products
-- These fields power the visual product catalog table in the CRM
-- ─────────────────────────────────────────────

ALTER TABLE medical_products
    ADD COLUMN IF NOT EXISTS precio_publico DECIMAL(10,2),          -- Precio público sin IVA
    ADD COLUMN IF NOT EXISTS precio_laboratorio DECIMAL(10,2),      -- Precio especial para laboratorios
    ADD COLUMN IF NOT EXISTS precio_distribuidor DECIMAL(10,2),     -- Precio para distribuidores
    ADD COLUMN IF NOT EXISTS presentaciones JSONB DEFAULT '[]',     -- [{cantidad: 5, precio: 400}, {cantidad: 10, precio: 750}]
    ADD COLUMN IF NOT EXISTS url_tienda TEXT,                        -- URL de la tienda en línea
    ADD COLUMN IF NOT EXISTS marca TEXT,                             -- Marca del producto
    ADD COLUMN IF NOT EXISTS analito TEXT,                           -- Analito / Biomarcador medido
    ADD COLUMN IF NOT EXISTS volumen_muestra TEXT,                   -- Volumen de muestra requerido
    ADD COLUMN IF NOT EXISTS punto_corte TEXT,                       -- Cut-off point
    ADD COLUMN IF NOT EXISTS vida_util TEXT,                         -- Shelf life (duplicated for clarity)
    ADD COLUMN IF NOT EXISTS registro_sanitario TEXT,                -- Registro sanitario (COFEPRIS, etc.)
    ADD COLUMN IF NOT EXISTS pitch_venta TEXT,                       -- Argumento de venta en una oración
    ADD COLUMN IF NOT EXISTS ventaja_competitiva TEXT,               -- Ventaja vs laboratorio tradicional
    ADD COLUMN IF NOT EXISTS roi_medico TEXT,                        -- ROI para el médico
    ADD COLUMN IF NOT EXISTS objeciones_respuestas JSONB DEFAULT '[]',  -- [{objecion: "...", respuesta: "..."}]
    ADD COLUMN IF NOT EXISTS palabras_clave TEXT[] DEFAULT '{}',    -- Keywords for search
    ADD COLUMN IF NOT EXISTS cross_sells INTEGER[] DEFAULT '{}',    -- Product IDs for cross-sell
    ADD COLUMN IF NOT EXISTS up_sells INTEGER[] DEFAULT '{}',       -- Product IDs for up-sell
    ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'ambos';   -- 'medico', 'laboratorio', 'ambos'

-- ─────────────────────────────────────────────
-- 2. Client classification: add 'classification' to customer_profiles
-- Determines language/tone the bot uses
-- ─────────────────────────────────────────────

ALTER TABLE customer_profiles
    ADD COLUMN IF NOT EXISTS client_classification TEXT DEFAULT 'desconocido'
        CHECK (client_classification IN ('medico', 'laboratorio', 'farmacia', 'distribuidor', 'particular', 'desconocido')),
    ADD COLUMN IF NOT EXISTS classification_confidence FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS classification_source TEXT DEFAULT 'pending'
        CHECK (classification_source IN ('manual', 'ai_detected', 'self_reported', 'woocommerce', 'pending')),
    ADD COLUMN IF NOT EXISTS preferred_language_tone TEXT DEFAULT 'formal';

-- ─────────────────────────────────────────────
-- 3. Add ai_instructions to campaigns (referenced in sync-google)
-- ─────────────────────────────────────────────

ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS ai_instructions TEXT;

-- ─────────────────────────────────────────────
-- 4. Business settings for default classification prompts
-- ─────────────────────────────────────────────

INSERT INTO business_settings (key, value) VALUES
    ('classification_prompt_medico', 'Usa un tono profesional y técnico. Habla de sensibilidad, especificidad, indicaciones clínicas. Ofrece presentaciones y precios para consultorios.'),
    ('classification_prompt_laboratorio', 'Usa un tono técnico-comercial enfocado en volumen, ROI y eficiencia. Habla de presentaciones mayoreo, certificaciones y registro sanitario. Ofrece precios de laboratorio.')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────
-- 5. Indexes
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_medical_products_target ON medical_products(target_audience);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_classification ON customer_profiles(client_classification);
