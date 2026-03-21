-- Migration 002: Phase 2 — Medical Bot Intelligence
-- Adds: medical products, PDF indexing metadata, customer business profiles
-- Date: 2026-03-19

-- ─────────────────────────────────────────────
-- 1. Medical Products
-- Structured clinical data for each diagnostic test product.
-- Used by the recommendation engine and RAG medical advisor.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_products (
    id SERIAL PRIMARY KEY,
    wc_product_id INTEGER,                           -- WooCommerce product ID
    name TEXT NOT NULL,
    sku TEXT,
    diagnostic_category TEXT NOT NULL,                -- 'infecciosas', 'embarazo', 'drogas', 'metabolicas', 'cardiologicas', 'oncologicas', 'ets'
    clinical_indications TEXT[] DEFAULT '{}',         -- Array of clinical indications
    sample_type TEXT,                                 -- 'sangre_total', 'suero', 'orina', 'hisopo_nasal', 'hisopo_orofaringeo', 'saliva', 'heces'
    sensitivity DECIMAL(5,2),                         -- % sensitivity (e.g., 98.50)
    specificity DECIMAL(5,2),                         -- % specificity
    result_time TEXT,                                 -- '15 minutos', '5 minutos', '10 minutos'
    methodology TEXT,                                 -- 'inmunocromatografia', 'pcr_rapida', 'elisa', 'aglutinacion'
    regulatory_approval TEXT,                         -- 'COFEPRIS', 'FDA', 'CE-IVD'
    complementary_product_ids INTEGER[] DEFAULT '{}', -- IDs of complementary medical_products
    recommended_profiles TEXT[] DEFAULT '{}',         -- 'laboratorio', 'farmacia', 'consultorio', 'hospital', 'clinica', 'punto_de_venta'
    contraindications TEXT,                           -- When NOT to use this test
    interpretation_guide TEXT,                        -- How to read results
    storage_conditions TEXT,                          -- '2-30°C', 'refrigerado 2-8°C'
    shelf_life TEXT,                                  -- '24 meses', '18 meses'
    technical_sheet_url TEXT,                         -- URL to PDF ficha técnica
    price_range TEXT,                                 -- 'economica', 'media', 'premium' (for recommendation logic)
    is_active BOOLEAN DEFAULT TRUE,
    embedding VECTOR(1536),                           -- Semantic embedding of product description
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_medical_products_category ON medical_products(diagnostic_category);
CREATE INDEX idx_medical_products_wc ON medical_products(wc_product_id);
CREATE INDEX idx_medical_products_active ON medical_products(is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────
-- 2. Medical Knowledge Chunks
-- Stores indexed chunks from PDF technical sheets.
-- Each chunk is linked to a medical product and has its own embedding.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_knowledge_chunks (
    id SERIAL PRIMARY KEY,
    medical_product_id INTEGER REFERENCES medical_products(id) ON DELETE CASCADE,
    chunk_type TEXT NOT NULL,                          -- 'indicaciones', 'procedimiento', 'interpretacion', 'especificaciones', 'almacenamiento', 'general'
    content TEXT NOT NULL,
    source_filename TEXT,
    page_number INTEGER,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_medical_chunks_product ON medical_knowledge_chunks(medical_product_id);
CREATE INDEX idx_medical_chunks_type ON medical_knowledge_chunks(chunk_type);

-- ─────────────────────────────────────────────
-- 3. Clinical Decision Trees
-- Pre-defined recommendation rules: symptoms/case → recommended tests.
-- Used by the recommendation engine before falling back to AI.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_decision_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,                                -- 'screening_prenatal', 'sintomas_respiratorios', 'deteccion_drogas'
    description TEXT,
    trigger_keywords TEXT[] NOT NULL,                  -- Keywords that activate this rule
    recommended_product_ids INTEGER[] NOT NULL,         -- medical_products IDs to recommend
    recommendation_reason TEXT NOT NULL,               -- "Para screening prenatal completo se recomienda..."
    client_profile_filter TEXT[],                      -- NULL = all, or ['laboratorio', 'hospital']
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_decision_rules_active ON clinical_decision_rules(is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────
-- 4. Customer Business Profile
-- Extends customer_attributes with structured business data.
-- Populated by AI analysis of conversations or manual entry.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_profiles (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
    business_type TEXT,                                -- 'laboratorio', 'farmacia', 'consultorio', 'hospital', 'clinica', 'distribuidor', 'particular'
    specialty TEXT,                                    -- 'medicina_general', 'pediatria', 'ginecologia', 'urgencias', 'laboratorio_clinico'
    estimated_monthly_volume TEXT,                     -- 'bajo_1_50', 'medio_51_200', 'alto_201_1000', 'mayoreo_1000_plus'
    detected_interests TEXT[] DEFAULT '{}',            -- Product categories they've asked about
    professional_title TEXT,                           -- 'Dr.', 'QFB', 'Lic.', 'Ing.'
    organization_name TEXT,                            -- Business name
    city TEXT,
    state TEXT,
    confidence_score FLOAT DEFAULT 0.5,               -- How confident we are in this profile (AI-detected vs manual)
    source TEXT DEFAULT 'ai_detected',                 -- 'ai_detected', 'manual', 'woocommerce_sync'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customer_profiles_type ON customer_profiles(business_type);
CREATE INDEX idx_customer_profiles_customer ON customer_profiles(customer_id);
