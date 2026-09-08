-- ============================================================
-- FASE 5.1 — Contacto cosechado en el banco de sourcing (2026-09-08)
--
-- sourcing_bank no guardaba email/teléfono: al conectar en LinkedIn
-- (1er grado), Unipile expone contact_info del perfil y
-- cron-activity-sync.mjs los cosecha y los guarda aquí (y en
-- candidates.email/phone si el item ya está promovido — solo si
-- estaban vacíos, nunca pisa datos existentes).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE sourcing_bank ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE sourcing_bank ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN sourcing_bank.email IS
  'Correo cosechado por cron-activity-sync al detectar la conexión aceptada en LinkedIn (contact_info de Unipile). Solo se escribe si estaba vacío.';
COMMENT ON COLUMN sourcing_bank.phone IS
  'Teléfono cosechado por cron-activity-sync al detectar la conexión aceptada en LinkedIn (contact_info de Unipile). Solo se escribe si estaba vacío.';
