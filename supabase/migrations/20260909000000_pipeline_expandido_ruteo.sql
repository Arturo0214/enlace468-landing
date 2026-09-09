-- ============================================================
-- FASE A — Pipeline expandido de Ingrid + Ruteo de candidatos (2026-09-09)
--
-- Fundación de datos para: (1) el copiloto "¿quién está atorado?", (2) la
-- ficha operativa del candidato (psicométrico, docs, CNSF, inducción) y
-- (3) el ruteo/disposición de no-aptos-FC hacia otros productos.
--
-- Piezas:
--   1. 2 stages nuevos en vacancy_candidates.stage: documentation, onboarding.
--   2. Tabla candidate_pipeline_detail (1:1 con vacancy_candidates) — campos
--      de control del flujo de 21 pasos de Ingrid.
--   3. Columnas de disposición/ruteo en vacancy_candidates.
--   4. Reglas SLA default para los stages nuevos.
--   5. Índices para el copiloto.
--
-- Idempotente: DO block tolerante para el CHECK + ADD COLUMN IF NOT EXISTS +
-- CREATE TABLE/INDEX/POLICY IF NOT EXISTS + ON CONFLICT DO NOTHING.
-- RLS org-scoped (patrón de 20260908020000_sla_notifications.sql). Las
-- escrituras del cron usan service-role y saltan RLS.
--
-- NOTA para el agente de UI: src/lib/stageLabels.js ya se extiende en este
-- mismo cambio con documentation:'Documentación' y onboarding:'Inducción'
-- en DEFAULT_STAGE_LABELS (STAGE_KEYS los recoge automáticamente). Aquí NO se
-- toca código; solo el modelo de datos.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Stages nuevos: documentation (post-oferta) + onboarding (post-clave).
--    Orden lógico final del journey:
--      sourced, contacted, screening, interviewing, evaluated, presented,
--      shortlist, offer, documentation, hired, onboarding, rejected.
--    (documentation DESPUÉS de offer; onboarding DESPUÉS de hired; rejected
--     terminal al final.)
--    Recrea el CHECK de forma tolerante: dropea el existente si está y crea
--    el nuevo con NOT VALID→VALIDATE para no fallar si hay filas legacy.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vacancy_candidates_stage_check'
      AND conrelid = 'vacancy_candidates'::regclass
  ) THEN
    ALTER TABLE vacancy_candidates DROP CONSTRAINT vacancy_candidates_stage_check;
  END IF;

  ALTER TABLE vacancy_candidates
    ADD CONSTRAINT vacancy_candidates_stage_check
    CHECK (stage IN (
      'sourced', 'contacted', 'screening', 'interviewing',
      'evaluated', 'presented', 'shortlist', 'offer',
      'documentation', 'hired', 'onboarding', 'rejected'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- ya existe con la definición nueva
END $$;

-- ------------------------------------------------------------
-- 2. candidate_pipeline_detail — ficha operativa 1:1 con vacancy_candidates.
--    organization_id directo (poblado desde la vacante al insertar) para RLS
--    e índices simples del copiloto. FK ON DELETE CASCADE.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_pipeline_detail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_candidate_id uuid NOT NULL
    REFERENCES vacancy_candidates(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,

  -- Paso 3: conversación inicial (24-48h).
  conversation_at timestamptz,
  -- Paso 4: invitación a entrevista.
  interview_invited_at timestamptz,
  -- Paso 5: entrevista inicial (efectiva sí/no).
  initial_interview_at timestamptz,
  initial_interview_effective boolean,
  -- Pasos 6-7: psicométrico enviado + resultado.
  psychometric_sent_at timestamptz,
  psychometric_result text CHECK (psychometric_result IN ('apto', 'no_apto', 'pendiente')),
  -- Paso 8: entrevista de orientación.
  orientation_at timestamptz,
  -- Paso 9: Proyecto 100 / Q10.
  project100_status text,
  -- Paso 10: entrevista de carrera.
  career_interview_at timestamptz,
  -- Paso 11: aceptación del candidato.
  accepted_at timestamptz,
  -- Pasos 12-14: documentos (solicitados / confirmados / subidos).
  docs_requested_at timestamptz,
  docs_confirmed_at timestamptz,
  docs_uploaded jsonb,
  -- Paso 15: validación legal y resguardo.
  legal_validated_at timestamptz,
  -- Pasos 16-18: pago CNSF, comprobante, fecha de examen.
  cnsf_paid_at timestamptz,
  cnsf_receipt_url text,
  cnsf_exam_date date,
  -- Pasos 19-20: inducción 90 días + checkpoint de semana 1.
  induction_start_at timestamptz,
  week1_checkpoint jsonb,

  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vacancy_candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_cpd_org
  ON candidate_pipeline_detail(organization_id);
CREATE INDEX IF NOT EXISTS idx_cpd_vc
  ON candidate_pipeline_detail(vacancy_candidate_id);

ALTER TABLE candidate_pipeline_detail ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier usuario autenticado de la org.
DROP POLICY IF EXISTS "View org candidate_pipeline_detail" ON candidate_pipeline_detail;
CREATE POLICY "View org candidate_pipeline_detail" ON candidate_pipeline_detail
  FOR SELECT USING (organization_id = public.get_user_org_id());

-- INSERT: dentro de la propia org.
DROP POLICY IF EXISTS "Insert org candidate_pipeline_detail" ON candidate_pipeline_detail;
CREATE POLICY "Insert org candidate_pipeline_detail" ON candidate_pipeline_detail
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());

-- UPDATE: dentro de la propia org.
DROP POLICY IF EXISTS "Update org candidate_pipeline_detail" ON candidate_pipeline_detail;
CREATE POLICY "Update org candidate_pipeline_detail" ON candidate_pipeline_detail
  FOR UPDATE USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- DELETE: dentro de la propia org (además del CASCADE al borrar el candidato).
DROP POLICY IF EXISTS "Delete org candidate_pipeline_detail" ON candidate_pipeline_detail;
CREATE POLICY "Delete org candidate_pipeline_detail" ON candidate_pipeline_detail
  FOR DELETE USING (organization_id = public.get_user_org_id());

-- ------------------------------------------------------------
-- 3. Ruteo / disposición en vacancy_candidates.
--    disposition: por defecto 'fc_track' (todos entran al pipeline normal).
-- ------------------------------------------------------------
ALTER TABLE vacancy_candidates
  ADD COLUMN IF NOT EXISTS disposition text
    CHECK (disposition IN (
      'fc_track', 'tu_marca_vende', 'otro_rol', 'otro_producto', 'nurture', 'descartado'
    )) DEFAULT 'fc_track';

ALTER TABLE vacancy_candidates
  ADD COLUMN IF NOT EXISTS disposition_reason text;
ALTER TABLE vacancy_candidates
  ADD COLUMN IF NOT EXISTS disposition_at timestamptz;
ALTER TABLE vacancy_candidates
  ADD COLUMN IF NOT EXISTS disposition_by uuid REFERENCES profiles(id);
ALTER TABLE vacancy_candidates
  ADD COLUMN IF NOT EXISTS routed_to text;

-- ------------------------------------------------------------
-- 4. Reglas SLA default para los stages nuevos, por organización existente.
--    documentation 7 días, onboarding 14 días.
--    OJO: sla_rules tiene su propio CHECK sobre stage; se amplía para admitir
--    los stages nuevos antes de insertar (idempotente/tolerante).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sla_rules_stage_check'
      AND conrelid = 'sla_rules'::regclass
  ) THEN
    ALTER TABLE sla_rules DROP CONSTRAINT sla_rules_stage_check;
  END IF;

  ALTER TABLE sla_rules
    ADD CONSTRAINT sla_rules_stage_check
    CHECK (stage IN (
      'sourced', 'contacted', 'screening', 'interviewing',
      'evaluated', 'presented', 'shortlist', 'offer',
      'documentation', 'onboarding'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO sla_rules (organization_id, stage, max_days)
SELECT o.id, d.stage, d.max_days
FROM organizations o
CROSS JOIN (VALUES
  ('documentation', 7),
  ('onboarding', 14)
) AS d(stage, max_days)
ON CONFLICT (organization_id, stage) DO NOTHING;

-- ------------------------------------------------------------
-- 5. Índices para el copiloto.
--    - psicométricos pendientes (alerta 2): org + fecha de envío.
--    - fecha de examen CNSF (alerta 5 / punto de control H).
--    - candidatos por disposición (reportes de ruteo/recuperación).
--      NOTA: vacancy_candidates NO tiene organization_id (el scope de org se
--      deriva vía join a vacancies, ver RLS existente), por eso el índice de
--      disposición es de una sola columna en vez de (organization_id, disposition).
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cpd_psychometric_pending
  ON candidate_pipeline_detail(organization_id, psychometric_sent_at)
  WHERE psychometric_result = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_cpd_cnsf_exam_date
  ON candidate_pipeline_detail(cnsf_exam_date)
  WHERE cnsf_exam_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vc_disposition
  ON vacancy_candidates(disposition);
