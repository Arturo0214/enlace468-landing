-- Modo emprendedores por vacante (feedback de Ingrid): los perfiles con negocio
-- propio (fundadores, dueños, asesores independientes) convierten mejor porque
-- no les da miedo emprender. Cuando está prendido, el sourcing dirige las
-- queries a fundadores/dueños/independientes y da boost al rasgo emprendedor.
--
-- El cron netlify/functions/cron-auto-source.mjs LEE esta columna
-- (v.entrepreneur_mode === true) para correr el sourcing nocturno en modo
-- emprendedores. La UI la escribe desde el panel de sourcing de la vacante.
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS entrepreneur_mode boolean DEFAULT false;

COMMENT ON COLUMN vacancies.entrepreneur_mode IS
  'Cuando true, el sourcing (manual y nocturno vía cron-auto-source) busca fundadores/dueños de negocio/asesores independientes con boost al rasgo emprendedor.';
