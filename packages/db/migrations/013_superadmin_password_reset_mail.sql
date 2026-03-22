-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 013: Superadmin, Password Reset y Sistema de Mail
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Cambios:
-- 1. Agregar rol 'superadmin' al CHECK constraint de agents
-- 2. Agregar columnas de reset de contraseña a agents
-- 3. Crear tabla system_mail_config para SMTP/IMAP
-- 4. Insertar usuario superadmin feruap@gmail.com
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Actualizar rol CHECK constraint en agents
-- ─────────────────────────────────────────────────────────────────────────────
-- Primero, eliminamos el constraint existente
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_role_check;

-- Luego, añadimos el nuevo constraint con 'superadmin' incluido
-- Incluye tanto nombres legacy (admin/supervisor/agent) como normalizados (director/gerente/operador)
ALTER TABLE agents ADD CONSTRAINT agents_role_check
    CHECK (role IN ('superadmin', 'admin', 'supervisor', 'agent', 'director', 'gerente', 'operador'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Agregar columnas de password reset a agents
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS reset_token TEXT,
    ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Crear tabla system_mail_config para almacenar configuración SMTP/IMAP
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_mail_config (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_encrypted TEXT NOT NULL,
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 465,
    smtp_encryption TEXT DEFAULT 'SSL/TLS',
    imap_host TEXT,
    imap_port INTEGER DEFAULT 993,
    imap_encryption TEXT DEFAULT 'SSL/TLS',
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES agents(id) ON DELETE SET NULL
);

-- Crear índice para búsqueda rápida por email
CREATE INDEX IF NOT EXISTS idx_system_mail_config_email ON system_mail_config(email);

-- Crear índice para filtrar configuraciones activas
CREATE INDEX IF NOT EXISTS idx_system_mail_config_active ON system_mail_config(is_active)
    WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Upsert usuario superadmin feruap@gmail.com
-- ─────────────────────────────────────────────────────────────────────────────
-- Se inserta con un hash placeholder que será actualizado por la aplicación en
-- la primera ejecución o mediante un endpoint de configuración inicial.
INSERT INTO agents (name, email, password_hash, role, is_active)
VALUES ('feruap', 'feruap@gmail.com', 'PLACEHOLDER_HASH_TO_UPDATE', 'superadmin', TRUE)
ON CONFLICT (email) DO UPDATE
    SET role = 'superadmin'
    WHERE agents.role != 'superadmin';

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN 013
-- ─────────────────────────────────────────────────────────────────────────────
