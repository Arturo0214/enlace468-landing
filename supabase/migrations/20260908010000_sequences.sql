-- ============================================================
-- FASE 5 — Motor de secuencias de outreach multi-touch
-- (estilo Gem/Lever sobre Netlify Scheduled Functions)
--
-- 4 tablas nuevas:
--   outreach_sequences   → definición de la secuencia (por org, vacante opc.)
--   sequence_steps       → pasos (día 0 connect → día 3 follow-up → día 7 email)
--   sequence_enrollments → candidato inscrito + puntero de avance (current_step)
--   scheduled_messages   → outbox auditable: TODO envío pasa por aquí
--
-- + trigger pause_sequence_on_reply (candidate_interactions inbound → replied)
-- + función pause_enrollments_for_bank(uuid) para items del banco sin candidato
--
-- 100% idempotente (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
-- ============================================================

-- ------------------------------------------------------------
-- 1. outreach_sequences
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  vacancy_id uuid REFERENCES vacancies(id) ON DELETE CASCADE, -- NULL = genérica de la org
  name text NOT NULL,
  is_active boolean DEFAULT true,
  stop_on_reply boolean DEFAULT true, -- al responder el candidato, se detiene la secuencia
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sequences_org ON outreach_sequences(organization_id);

-- ------------------------------------------------------------
-- 2. sequence_steps
--    day_offset es ABSOLUTO desde el día de inscripción (día 0);
--    el runner calcula el delta entre pasos consecutivos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  day_offset int NOT NULL DEFAULT 0,
  channel text NOT NULL CHECK (channel IN ('linkedin_connect', 'linkedin_message', 'linkedin_inmail', 'email', 'whatsapp_manual')),
  template_subject text,
  template_body text, -- soporta {{nombre}} {{vacante}} {{puesto}}
  ai_generate boolean DEFAULT false, -- true → generateDraft (Haiku) en vez de plantilla
  condition text DEFAULT 'always' CHECK (condition IN ('always', 'if_connected', 'if_not_connected')),
  UNIQUE(sequence_id, step_order)
);

-- ------------------------------------------------------------
-- 3. sequence_enrollments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  sourcing_bank_id uuid REFERENCES sourcing_bank(id) ON DELETE CASCADE,
  vacancy_candidate_id uuid REFERENCES vacancy_candidates(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'replied', 'completed', 'stopped', 'bounced')),
  current_step int NOT NULL DEFAULT 0, -- pasos ya procesados; steps[current_step] es el siguiente
  next_run_at timestamptz,
  paused_reason text,
  enrolled_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (sourcing_bank_id IS NOT NULL OR vacancy_candidate_id IS NOT NULL)
);

-- El runner solo escanea activos con next_run_at vencido → índice parcial.
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_run
  ON sequence_enrollments(next_run_at) WHERE status = 'active';
-- Para el trigger de pausa y la UI ("¿ya está inscrito?")
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_vc
  ON sequence_enrollments(vacancy_candidate_id) WHERE vacancy_candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_bank
  ON sequence_enrollments(sourcing_bank_id) WHERE sourcing_bank_id IS NOT NULL;

-- ANTI-BAN: la misma persona NUNCA se inscribe dos veces a la misma secuencia
-- (ni siquiera tras completarla) — evita re-spamear a un candidato.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sequence_enrollments_seq_bank
  ON sequence_enrollments(sequence_id, sourcing_bank_id) WHERE sourcing_bank_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sequence_enrollments_seq_vc
  ON sequence_enrollments(sequence_id, vacancy_candidate_id) WHERE vacancy_candidate_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. scheduled_messages (outbox auditable — ÚNICO punto de envío)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  enrollment_id uuid NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id uuid REFERENCES sequence_steps(id) ON DELETE SET NULL,
  channel text NOT NULL,
  recipient jsonb DEFAULT '{}', -- { full_name, url, provider_id, email }
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'canceled', 'skipped')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  error text,
  external_id text, -- id de Unipile/Resend ('dry-run' en pruebas)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due
  ON scheduled_messages(scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_enrollment
  ON scheduled_messages(enrollment_id);
-- Cuota anti-ban: cuenta 'sent' de LinkedIn por org/día/semana.
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_quota
  ON scheduled_messages(organization_id, sent_at) WHERE status = 'sent';

-- ------------------------------------------------------------
-- 5. Trigger pause_sequence_on_reply
--    candidate_interactions inbound (extensión Chrome, sync Unipile,
--    Resend inbound, registro manual) → enrollments activos del
--    vacancy_candidate a 'replied' + cancela sus mensajes en cola.
--    Respeta outreach_sequences.stop_on_reply.
--    Patrón defensivo (como log_stage_transition): un error del log
--    JAMÁS bloquea el insert de la interacción.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION pause_sequence_on_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF new.direction = 'inbound' AND new.vacancy_candidate_id IS NOT NULL THEN
      UPDATE sequence_enrollments
        SET status = 'replied', updated_at = now()
        WHERE vacancy_candidate_id = new.vacancy_candidate_id
          AND status = 'active'
          AND sequence_id IN (SELECT id FROM outreach_sequences WHERE stop_on_reply);
      UPDATE scheduled_messages
        SET status = 'canceled', error = 'replied'
        WHERE status = 'queued'
          AND enrollment_id IN (
            SELECT id FROM sequence_enrollments
            WHERE vacancy_candidate_id = new.vacancy_candidate_id AND status = 'replied'
          );
    END IF;
  EXCEPTION WHEN others THEN
    -- swallow: pausar secuencias es secundario; la interacción va primero
    NULL;
  END;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_pause_sequence_on_reply ON candidate_interactions;
CREATE TRIGGER trg_pause_sequence_on_reply
  AFTER INSERT ON candidate_interactions
  FOR EACH ROW EXECUTE FUNCTION pause_sequence_on_reply();

-- ------------------------------------------------------------
-- 6. pause_enrollments_for_bank(bank_id)
--    Para items del banco SIN candidate_id/vacancy_candidate (no hay
--    candidate_interactions donde disparar el trigger): la llama
--    cron-activity-sync vía RPC cuando detecta respuesta en LinkedIn.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION pause_enrollments_for_bank(bank_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    UPDATE sequence_enrollments
      SET status = 'replied', updated_at = now()
      WHERE sourcing_bank_id = bank_id
        AND status = 'active'
        AND sequence_id IN (SELECT id FROM outreach_sequences WHERE stop_on_reply);
    UPDATE scheduled_messages
      SET status = 'canceled', error = 'replied'
      WHERE status = 'queued'
        AND enrollment_id IN (
          SELECT id FROM sequence_enrollments
          WHERE sourcing_bank_id = bank_id AND status = 'replied'
        );
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

-- ------------------------------------------------------------
-- 7. RLS org-scoped (patrón de 20260624000000_sourcing_bank.sql)
-- ------------------------------------------------------------
ALTER TABLE outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View org outreach_sequences" ON outreach_sequences;
CREATE POLICY "View org outreach_sequences" ON outreach_sequences
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Insert org outreach_sequences" ON outreach_sequences;
CREATE POLICY "Insert org outreach_sequences" ON outreach_sequences
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Update org outreach_sequences" ON outreach_sequences;
CREATE POLICY "Update org outreach_sequences" ON outreach_sequences
  FOR UPDATE TO authenticated USING (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Delete org outreach_sequences" ON outreach_sequences;
CREATE POLICY "Delete org outreach_sequences" ON outreach_sequences
  FOR DELETE TO authenticated USING (organization_id = public.get_user_org_id());

-- sequence_steps no lleva organization_id → scope vía su secuencia.
DROP POLICY IF EXISTS "View org sequence_steps" ON sequence_steps;
CREATE POLICY "View org sequence_steps" ON sequence_steps
  FOR SELECT TO authenticated USING (
    sequence_id IN (SELECT id FROM outreach_sequences WHERE organization_id = public.get_user_org_id())
  );
DROP POLICY IF EXISTS "Insert org sequence_steps" ON sequence_steps;
CREATE POLICY "Insert org sequence_steps" ON sequence_steps
  FOR INSERT TO authenticated WITH CHECK (
    sequence_id IN (SELECT id FROM outreach_sequences WHERE organization_id = public.get_user_org_id())
  );
DROP POLICY IF EXISTS "Update org sequence_steps" ON sequence_steps;
CREATE POLICY "Update org sequence_steps" ON sequence_steps
  FOR UPDATE TO authenticated USING (
    sequence_id IN (SELECT id FROM outreach_sequences WHERE organization_id = public.get_user_org_id())
  );
DROP POLICY IF EXISTS "Delete org sequence_steps" ON sequence_steps;
CREATE POLICY "Delete org sequence_steps" ON sequence_steps
  FOR DELETE TO authenticated USING (
    sequence_id IN (SELECT id FROM outreach_sequences WHERE organization_id = public.get_user_org_id())
  );

DROP POLICY IF EXISTS "View org sequence_enrollments" ON sequence_enrollments;
CREATE POLICY "View org sequence_enrollments" ON sequence_enrollments
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Insert org sequence_enrollments" ON sequence_enrollments;
CREATE POLICY "Insert org sequence_enrollments" ON sequence_enrollments
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Update org sequence_enrollments" ON sequence_enrollments;
CREATE POLICY "Update org sequence_enrollments" ON sequence_enrollments
  FOR UPDATE TO authenticated USING (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Delete org sequence_enrollments" ON sequence_enrollments;
CREATE POLICY "Delete org sequence_enrollments" ON sequence_enrollments
  FOR DELETE TO authenticated USING (organization_id = public.get_user_org_id());

DROP POLICY IF EXISTS "View org scheduled_messages" ON scheduled_messages;
CREATE POLICY "View org scheduled_messages" ON scheduled_messages
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Insert org scheduled_messages" ON scheduled_messages;
CREATE POLICY "Insert org scheduled_messages" ON scheduled_messages
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Update org scheduled_messages" ON scheduled_messages;
CREATE POLICY "Update org scheduled_messages" ON scheduled_messages
  FOR UPDATE TO authenticated USING (organization_id = public.get_user_org_id());
DROP POLICY IF EXISTS "Delete org scheduled_messages" ON scheduled_messages;
CREATE POLICY "Delete org scheduled_messages" ON scheduled_messages
  FOR DELETE TO authenticated USING (organization_id = public.get_user_org_id());
