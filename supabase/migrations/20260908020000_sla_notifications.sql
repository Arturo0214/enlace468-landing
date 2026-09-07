-- ============================================================
-- FASE 6 — SLAs por etapa + notificaciones in-app (2026-09-08)
--
-- 1. sla_rules      — máximo de días permitidos por etapa, por organización.
-- 2. notifications  — bandeja in-app (campana del Topbar); recipient_id NULL
--                     significa "toda la organización".
-- 3. Seed de reglas default por cada organización existente.
--
-- Idempotente: CREATE IF NOT EXISTS + DROP POLICY IF EXISTS + ON CONFLICT.
-- Las escrituras del cron (cron-sla-check.mjs) usan service-role y saltan RLS;
-- las policies de abajo son para el frontend (anon key + JWT).
-- ============================================================

-- ------------------------------------------------------------
-- 1. sla_rules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sla_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  -- Solo etapas "activas" del journey: hired/rejected son terminales y no
  -- tienen SLA. (shortlist existe en el journey aunque el kanban no la pinte.)
  stage text NOT NULL CHECK (stage IN (
    'sourced', 'contacted', 'screening', 'interviewing',
    'evaluated', 'presented', 'shortlist', 'offer'
  )),
  max_days int NOT NULL CHECK (max_days > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_sla_rules_org ON sla_rules(organization_id);

ALTER TABLE sla_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier usuario autenticado de la org (el pipeline pinta badges).
DROP POLICY IF EXISTS "View org sla_rules" ON sla_rules;
CREATE POLICY "View org sla_rules" ON sla_rules
  FOR SELECT USING (organization_id = public.get_user_org_id());

-- Escritura: solo admin/super_admin de la org (mismo patrón que
-- "Admins update own organization" en 20260908000000_reconcile_drift.sql).
DROP POLICY IF EXISTS "Admins insert org sla_rules" ON sla_rules;
CREATE POLICY "Admins insert org sla_rules" ON sla_rules
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins update org sla_rules" ON sla_rules;
CREATE POLICY "Admins update org sla_rules" ON sla_rules
  FOR UPDATE USING (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  ) WITH CHECK (
    organization_id = public.get_user_org_id()
  );

DROP POLICY IF EXISTS "Admins delete org sla_rules" ON sla_rules;
CREATE POLICY "Admins delete org sla_rules" ON sla_rules
  FOR DELETE USING (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ------------------------------------------------------------
-- 2. notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  -- NULL = notificación para toda la organización (p. ej. sla_breach).
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice parcial para el badge de no-leídas de la campana.
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_id, created_at) WHERE read_at IS NULL;
-- La campana y el dedupe del cron consultan por org + fecha (+ entity_id).
CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON notifications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON notifications(entity_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: mías o de toda mi org (recipient NULL).
DROP POLICY IF EXISTS "View own or org notifications" ON notifications;
CREATE POLICY "View own or org notifications" ON notifications
  FOR SELECT USING (
    recipient_id = auth.uid()
    OR (recipient_id IS NULL AND organization_id = public.get_user_org_id())
  );

-- UPDATE (marcar leída): mismo alcance que el SELECT.
DROP POLICY IF EXISTS "Update own or org notifications" ON notifications;
CREATE POLICY "Update own or org notifications" ON notifications
  FOR UPDATE USING (
    recipient_id = auth.uid()
    OR (recipient_id IS NULL AND organization_id = public.get_user_org_id())
  ) WITH CHECK (
    recipient_id = auth.uid()
    OR (recipient_id IS NULL AND organization_id = public.get_user_org_id())
  );

-- Sin policy de INSERT/DELETE para authenticated: las notificaciones las crea
-- el sistema (service-role) y no se borran desde el cliente.

-- ------------------------------------------------------------
-- 3. Seed de reglas default por organización existente
--    (mismos defaults que usa SettingsPage cuando la org no tiene reglas).
-- ------------------------------------------------------------
INSERT INTO sla_rules (organization_id, stage, max_days)
SELECT o.id, d.stage, d.max_days
FROM organizations o
CROSS JOIN (VALUES
  ('sourced', 5),
  ('contacted', 3),
  ('screening', 5),
  ('interviewing', 7),
  ('evaluated', 3),
  ('presented', 7),
  ('shortlist', 5),
  ('offer', 5)
) AS d(stage, max_days)
ON CONFLICT (organization_id, stage) DO NOTHING;
