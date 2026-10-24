-- Agrega la etapa 'career_interview' (Entrevista de carrera) entre
-- 'interviewing' (Agendado) y 'evaluated' (EI Efectiva). Es una etapa nueva del
-- pipeline, así que hay que ampliar los CHECK de stage en las tablas que lo
-- validan. Idempotente: se puede correr varias veces sin romper.

DO $$ BEGIN
  ALTER TABLE vacancy_candidates DROP CONSTRAINT IF EXISTS vacancy_candidates_stage_check;
  ALTER TABLE vacancy_candidates ADD CONSTRAINT vacancy_candidates_stage_check
    CHECK (stage IN (
      'sourced', 'contacted', 'screening', 'interviewing', 'career_interview',
      'evaluated', 'presented', 'shortlist', 'offer', 'hired', 'rejected'
    ));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'career_interview: no se pudo recrear vacancy_candidates_stage_check: %', SQLERRM;
END $$;

-- NOTA: NO se toca el CHECK de sla_rules. Su constraint ya admite etapas extra
-- (documentation/onboarding) con filas existentes; recrearlo con una lista más
-- corta rompía ("check constraint is violated by some row"). career_interview
-- no necesita SLA para funcionar; si más adelante se quiere SLA en esa etapa,
-- se amplía el CHECK de sla_rules SIN quitar las etapas ya usadas.
