-- ============================================================
-- Enlace 468 - Plans & Subscriptions
-- Migration 002: Plans, Subscriptions, Super-Admin role
-- ============================================================

-- 1. Plans catalog
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line text NOT NULL CHECK (product_line IN ('enterprise', 'talent_desk', 'recruiter_pro', 'academy', 'tu_marca_vende')),
  tier text NOT NULL,
  name text NOT NULL,
  price_mxn numeric NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('one_time', 'monthly', 'per_vacancy')),
  setup_fee_mxn numeric DEFAULT 0,
  features jsonb DEFAULT '[]',
  limits jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Subscriptions (org or individual)
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  profile_id uuid REFERENCES profiles(id),
  plan_id uuid REFERENCES plans(id) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Extend profiles role to include super_admin
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'admin', 'recruiter'));

-- 4. RLS for plans (read-only for all authenticated)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON plans
  FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins manage plans" ON plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 5. RLS for subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own org subscriptions" ON subscriptions
  FOR SELECT USING (
    organization_id = public.get_user_org_id()
    OR profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
CREATE POLICY "Super admins manage subscriptions" ON subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 6. Indexes
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_profile ON subscriptions(profile_id);
CREATE INDEX idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX idx_plans_product_line ON plans(product_line);

-- 7. Updated_at trigger
CREATE TRIGGER tr_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- SEED: Default plans (first 2 tiers per product line)
-- ============================================================

INSERT INTO plans (product_line, tier, name, price_mxn, billing_cycle, setup_fee_mxn, features, limits, sort_order) VALUES
-- Enterprise
('enterprise', 'starter', 'Enterprise Starter', 14900, 'monthly', 25000,
 '["Plataforma base con configuración inicial","1 usuario administrador","Hasta 3 vacantes activas","Screening automático","Pipeline de reclutamiento","Plantillas prediseñadas","Reporte básico mensual"]',
 '{"max_users": 1, "max_vacancies": 3}', 1),
('enterprise', 'growth', 'Enterprise Growth', 29900, 'monthly', 45000,
 '["Todo lo de Starter","Hasta 8 vacantes activas","Banco de candidatos persistente","Prompts personalizados de IA","Reportes ejecutivos avanzados","Sesión mensual con Ingrid/Propulsa"]',
 '{"max_users": 5, "max_vacancies": 8}', 2),

-- Talent Desk
('talent_desk', 'light', 'Talent Desk Light', 4900, 'per_vacancy', 0,
 '["10 candidatos mapeados","Búsqueda inicial de talento","Ficha resumida por candidato","Recomendación básica"]',
 '{"candidates_per_vacancy": 10}', 1),
('talent_desk', 'pro', 'Talent Desk Pro', 9900, 'per_vacancy', 0,
 '["15 candidatos mapeados","Ranking por match","Comentarios cualitativos","Mensajes de outreach sugeridos","Reporte ejecutivo"]',
 '{"candidates_per_vacancy": 15}', 2),

-- Recruiter Pro
('recruiter_pro', 'basic', 'Recruiter Basic', 499, 'monthly', 0,
 '["Prompts de reclutamiento con IA","Plantillas de comunicación","Guías de búsqueda","Formatos de seguimiento"]',
 '{"max_vacancies": 2}', 1),
('recruiter_pro', 'pro', 'Recruiter Pro', 899, 'monthly', 0,
 '["Herramientas avanzadas de búsqueda","Screening asistido por IA","Templates de outreach","Pipeline básico","Banco individual de talento"]',
 '{"max_vacancies": 5}', 2),

-- Academy
('academy', 'free', 'Academy Free', 0, 'monthly', 0,
 '["Acceso limitado a recursos","Newsletter semanal","Clase abierta o material de muestra"]',
 '{}', 1),
('academy', 'founder', 'Academy Founder', 299, 'monthly', 0,
 '["Prompts básicos de reclutamiento","Plantillas descargables","Mini guías","Comunidad privada","Recursos exclusivos"]',
 '{}', 2),

-- Tu Marca Vende
('tu_marca_vende', 'diagnostico', 'Diagnóstico OpenToWork', 399, 'one_time', 0,
 '["Diagnóstico rápido de LinkedIn/CV","Score básico de perfil","Recomendaciones iniciales"]',
 '{}', 1),
('tu_marca_vende', 'perfil_pro', 'Perfil Profesional IA', 1499, 'one_time', 0,
 '["Optimización completa de CV","Headline profesional","Sección Acerca de mí","Palabras clave estratégicas","Pitch profesional"]',
 '{}', 2);
