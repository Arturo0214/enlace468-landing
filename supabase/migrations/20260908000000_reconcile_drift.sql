-- ============================================================
-- FASE 0 — Reconciliación de drift entre prod y migraciones
-- (2026-09-08)
--
-- En prod existen `candidate_interactions` e `interview_notes`
-- creadas a mano (sin migración) y el CHECK de stage ya incluye
-- 'screening' y 'shortlist'. Esta migración versiona ese estado
-- EXACTO (DDL copiado de prod vía information_schema/pg_constraint
-- el 2026-09-07) y agrega las columnas nuevas de Fase 0/1.
--
-- 100% idempotente: corre sin error tanto sobre prod (donde las
-- tablas ya existen) como sobre una BD limpia.
-- Solo toca el esquema `public` (el proyecto Supabase es compartido).
-- ============================================================

-- ------------------------------------------------------------
-- 1. candidate_interactions (timeline de contacto por candidato)
--    Columnas idénticas a prod.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_candidate_id uuid REFERENCES vacancy_candidates(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text,
  direction text DEFAULT 'outbound',
  performed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Columnas nuevas (Fase 0): origen de la interacción + id externo
-- (Unipile/Resend/extensión) para dedupe de syncs automáticos.
ALTER TABLE candidate_interactions ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE candidate_interactions ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_candidate_interactions_vc_created
  ON candidate_interactions(vacancy_candidate_id, created_at);
-- Unicidad solo cuando hay id externo (los registros manuales no lo llevan).
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_interactions_external_id
  ON candidate_interactions(external_id) WHERE external_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. interview_notes (notas de entrevista)
--    Columnas y CHECKs idénticos a prod.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_candidate_id uuid NOT NULL REFERENCES vacancy_candidates(id) ON DELETE CASCADE,
  interview_date timestamptz NOT NULL DEFAULT now(),
  interviewer text,
  interview_type text CHECK (interview_type IN ('phone_screen', 'technical', 'behavioral', 'cultural', 'final', 'client')),
  overall_rating integer CHECK (overall_rating >= 1 AND overall_rating <= 5),
  verdict text CHECK (verdict IN ('advance', 'hold', 'reject')),
  strengths text[],
  concerns text[],
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_notes_vc ON interview_notes(vacancy_candidate_id);

-- ------------------------------------------------------------
-- 3. CHECK de vacancy_candidates.stage — lista EXACTA de prod
--    (incluye 'screening' y 'shortlist'; la migración inicial no
--    los tenía). DO block tolerante: si algo falla (p. ej. una fila
--    con stage fuera de lista en una BD divergente) NO tumba la
--    migración, solo avisa.
-- ------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE vacancy_candidates DROP CONSTRAINT IF EXISTS vacancy_candidates_stage_check;
  ALTER TABLE vacancy_candidates ADD CONSTRAINT vacancy_candidates_stage_check
    CHECK (stage IN ('sourced', 'contacted', 'screening', 'interviewing', 'evaluated', 'presented', 'shortlist', 'offer', 'hired', 'rejected'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'reconcile_drift: no se pudo recrear vacancy_candidates_stage_check: %', SQLERRM;
END $$;

-- ------------------------------------------------------------
-- 4. sourcing_bank: persistir el score del sourcing automático
--    (hoy se pierde al guardar → banco sin ranking).
-- ------------------------------------------------------------
ALTER TABLE sourcing_bank ADD COLUMN IF NOT EXISTS score numeric;
ALTER TABLE sourcing_bank ADD COLUMN IF NOT EXISTS score_details jsonb;

-- ------------------------------------------------------------
-- 5. vacancies: toggles del sourcing automático nocturno (Fase 1)
-- ------------------------------------------------------------
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS auto_source_enabled boolean DEFAULT false;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS auto_promote_min_score int;
-- Rotación justa del cron (procesa primero la vacante menos recién corrida)
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS last_auto_sourced_at timestamptz;

-- ------------------------------------------------------------
-- 5b. Higiene de base (Fase 4): frescura/verificación de perfiles
--     verify_status: 'activo' | 'cambio_empleo' | 'desactualizado'
--                    | 'link_muerto' | 'fantasma'
-- ------------------------------------------------------------
ALTER TABLE sourcing_bank ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE sourcing_bank ADD COLUMN IF NOT EXISTS verify_status text;
ALTER TABLE sourcing_bank ADD COLUMN IF NOT EXISTS verify_details jsonb;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verify_status text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verify_details jsonb;

-- ------------------------------------------------------------
-- 6. RLS — habilitar (idempotente) y recrear las policies con la
--    MISMA semántica que hoy tienen en prod (verificado en
--    pg_policies el 2026-09-07). No se agregan ni quitan permisos.
-- ------------------------------------------------------------
ALTER TABLE candidate_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_notes ENABLE ROW LEVEL SECURITY;

-- candidate_interactions: en prod existen DOS policies permisivas
-- (ALL / USING true). Se replican tal cual. NOTA: "Users can manage
-- interactions" aplica a {public} con USING(true) — es muy laxa;
-- endurecerla queda para una fase posterior (cambiarla aquí
-- rompería el contrato de "misma semántica").
DROP POLICY IF EXISTS "Allow all for authenticated" ON candidate_interactions;
CREATE POLICY "Allow all for authenticated" ON candidate_interactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage interactions" ON candidate_interactions;
CREATE POLICY "Users can manage interactions" ON candidate_interactions
  FOR ALL USING (true) WITH CHECK (true);

-- interview_notes: org-scoped vía vacancy_candidates → vacancies.
-- En prod solo hay SELECT / INSERT / DELETE (sin UPDATE) — se
-- respeta tal cual.
DROP POLICY IF EXISTS "View org interview_notes" ON interview_notes;
CREATE POLICY "View org interview_notes" ON interview_notes
  FOR SELECT USING (
    vacancy_candidate_id IN (
      SELECT vc.id FROM vacancy_candidates vc
      JOIN vacancies v ON v.id = vc.vacancy_id
      WHERE v.organization_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Insert org interview_notes" ON interview_notes;
CREATE POLICY "Insert org interview_notes" ON interview_notes
  FOR INSERT WITH CHECK (
    vacancy_candidate_id IN (
      SELECT vc.id FROM vacancy_candidates vc
      JOIN vacancies v ON v.id = vc.vacancy_id
      WHERE v.organization_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Delete org interview_notes" ON interview_notes;
CREATE POLICY "Delete org interview_notes" ON interview_notes
  FOR DELETE USING (
    vacancy_candidate_id IN (
      SELECT vc.id FROM vacancy_candidates vc
      JOIN vacancies v ON v.id = vc.vacancy_id
      WHERE v.organization_id = public.get_user_org_id()
    )
  );

-- ------------------------------------------------------------
-- 7. FASE 2 — Nombres del journey configurables.
--    El editor "Etapas del proceso" (Configuración) guarda
--    organizations.settings.stage_labels (jsonb, map stage→etiqueta).
--    En prod SOLO existe policy SELECT sobre organizations
--    ("View own organization"), sin UPDATE (verificado en
--    pg_policies el 2026-09-07): sin esto el guardado falla en
--    silencio. Scoped a la propia org y solo admin/super_admin.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins update own organization" ON organizations;
CREATE POLICY "Admins update own organization" ON organizations
  FOR UPDATE USING (
    id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  ) WITH CHECK (
    id = public.get_user_org_id()
  );
