-- Outreach tracking en el banco de sourcing.
-- Registra el contacto por LinkedIn (conexión/InMail) enviado desde el CRM, para
-- que el tablero muestre SOLO nuestro outreach (no la actividad personal de la
-- cuenta) y ligue estado (enviado → aceptado → respondido) a candidato + vacante.
-- Cambios aditivos: no afectan datos existentes.

ALTER TABLE sourcing_bank
  ADD COLUMN IF NOT EXISTS contact_status   text,        -- 'invited' | 'inmail_sent'
  ADD COLUMN IF NOT EXISTS contact_channel  text,        -- 'linkedin_note' | 'linkedin_message' | ...
  ADD COLUMN IF NOT EXISTS contacted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS contact_message  text,
  ADD COLUMN IF NOT EXISTS provider_id      text,        -- id interno de LinkedIn (Unipile)
  ADD COLUMN IF NOT EXISTS invitation_id    text;        -- id de la invitación (Unipile)

CREATE INDEX IF NOT EXISTS idx_sourcing_bank_contacted
  ON sourcing_bank (organization_id, contacted_at)
  WHERE contact_status IS NOT NULL;
