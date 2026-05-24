-- ============================================================
-- Enlace 468 - CRM de Reclutamiento
-- Migration 001: Initial Schema
-- ============================================================

-- 1. Organizations (multi-tenant root)
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Profiles (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id),
  full_name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  role text NOT NULL DEFAULT 'recruiter' CHECK (role IN ('admin', 'recruiter')),
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Vacancies
CREATE TABLE vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  created_by uuid REFERENCES profiles(id),
  title text NOT NULL,
  company_name text,
  department text,
  location text,
  modality text CHECK (modality IN ('remote', 'onsite', 'hybrid')),
  salary_min numeric,
  salary_max numeric,
  salary_currency text DEFAULT 'MXN',
  description text,
  requirements jsonb DEFAULT '[]',
  competencies jsonb DEFAULT '[]',
  challenges text,
  team_info text,
  benefits jsonb DEFAULT '[]',
  scorecard jsonb,
  ai_benchmark jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'on_hold', 'closed_filled', 'closed_cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  target_date date,
  closed_at timestamptz,
  closed_reason text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Candidates (persistent bank)
CREATE TABLE candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  linkedin_url text,
  location text,
  current_title text,
  current_company text,
  years_experience numeric,
  salary_expectation numeric,
  cv_url text,
  cv_text text,
  tags text[] DEFAULT '{}',
  source text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Vacancy Candidates (pipeline junction)
CREATE TABLE vacancy_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid REFERENCES vacancies(id) ON DELETE CASCADE NOT NULL,
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  stage text NOT NULL DEFAULT 'sourced' CHECK (stage IN ('sourced', 'contacted', 'interviewing', 'evaluated', 'presented', 'offer', 'hired', 'rejected')),
  match_score numeric,
  match_details jsonb,
  rejection_reason text,
  assigned_to uuid REFERENCES profiles(id),
  notes text,
  stage_changed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(vacancy_id, candidate_id)
);

-- 6. Interviews
CREATE TABLE interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_candidate_id uuid REFERENCES vacancy_candidates(id) ON DELETE CASCADE NOT NULL,
  interviewer_id uuid REFERENCES profiles(id),
  interview_type text CHECK (interview_type IN ('phone_screen', 'technical', 'cultural', 'final', 'client')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 30,
  location text,
  meet_link text,
  calendar_event_id text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  raw_notes text,
  ai_summary text,
  scores jsonb,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Communications (message log)
CREATE TABLE communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  vacancy_candidate_id uuid REFERENCES vacancy_candidates(id),
  candidate_id uuid REFERENCES candidates(id),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  template_key text,
  subject text,
  body text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  sent_at timestamptz,
  sent_by uuid REFERENCES profiles(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 8. Activity Log (audit trail)
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  performed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 9. Intake Sessions (AI-assisted vacancy definition)
CREATE TABLE intake_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid REFERENCES vacancies(id),
  conducted_by uuid REFERENCES profiles(id),
  conversation jsonb NOT NULL DEFAULT '[]',
  extracted_data jsonb,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_profiles_org ON profiles(organization_id);
CREATE INDEX idx_vacancies_org_status ON vacancies(organization_id, status);
CREATE INDEX idx_candidates_org ON candidates(organization_id);
CREATE INDEX idx_candidates_tags ON candidates USING GIN(tags);
CREATE INDEX idx_vacancy_candidates_vacancy ON vacancy_candidates(vacancy_id);
CREATE INDEX idx_vacancy_candidates_stage ON vacancy_candidates(vacancy_id, stage);
CREATE INDEX idx_vacancy_candidates_candidate ON vacancy_candidates(candidate_id);
CREATE INDEX idx_interviews_vc ON interviews(vacancy_candidate_id);
CREATE INDEX idx_interviews_scheduled ON interviews(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_communications_vc ON communications(vacancy_candidate_id);
CREATE INDEX idx_communications_candidate ON communications(candidate_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacancy_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function in PUBLIC schema (not auth)
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Organizations: users can view their own org
CREATE POLICY "View own organization" ON organizations
  FOR SELECT USING (id = public.get_user_org_id());

-- Profiles: users can view profiles in their org
CREATE POLICY "View org profiles" ON profiles
  FOR SELECT USING (organization_id = public.get_user_org_id());

CREATE POLICY "Update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Vacancies: full CRUD within org
CREATE POLICY "View org vacancies" ON vacancies
  FOR SELECT USING (organization_id = public.get_user_org_id());

CREATE POLICY "Insert org vacancies" ON vacancies
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Update org vacancies" ON vacancies
  FOR UPDATE USING (organization_id = public.get_user_org_id());

CREATE POLICY "Delete org vacancies" ON vacancies
  FOR DELETE USING (organization_id = public.get_user_org_id());

-- Candidates: full CRUD within org
CREATE POLICY "View org candidates" ON candidates
  FOR SELECT USING (organization_id = public.get_user_org_id());

CREATE POLICY "Insert org candidates" ON candidates
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Update org candidates" ON candidates
  FOR UPDATE USING (organization_id = public.get_user_org_id());

CREATE POLICY "Delete org candidates" ON candidates
  FOR DELETE USING (organization_id = public.get_user_org_id());

-- Vacancy Candidates: access via vacancy's org
CREATE POLICY "View org vacancy_candidates" ON vacancy_candidates
  FOR SELECT USING (
    vacancy_id IN (SELECT id FROM vacancies WHERE organization_id = public.get_user_org_id())
  );

CREATE POLICY "Insert org vacancy_candidates" ON vacancy_candidates
  FOR INSERT WITH CHECK (
    vacancy_id IN (SELECT id FROM vacancies WHERE organization_id = public.get_user_org_id())
  );

CREATE POLICY "Update org vacancy_candidates" ON vacancy_candidates
  FOR UPDATE USING (
    vacancy_id IN (SELECT id FROM vacancies WHERE organization_id = public.get_user_org_id())
  );

CREATE POLICY "Delete org vacancy_candidates" ON vacancy_candidates
  FOR DELETE USING (
    vacancy_id IN (SELECT id FROM vacancies WHERE organization_id = public.get_user_org_id())
  );

-- Interviews: access via vacancy_candidate -> vacancy -> org
CREATE POLICY "View org interviews" ON interviews
  FOR SELECT USING (
    vacancy_candidate_id IN (
      SELECT vc.id FROM vacancy_candidates vc
      JOIN vacancies v ON v.id = vc.vacancy_id
      WHERE v.organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Insert org interviews" ON interviews
  FOR INSERT WITH CHECK (
    vacancy_candidate_id IN (
      SELECT vc.id FROM vacancy_candidates vc
      JOIN vacancies v ON v.id = vc.vacancy_id
      WHERE v.organization_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Update org interviews" ON interviews
  FOR UPDATE USING (
    vacancy_candidate_id IN (
      SELECT vc.id FROM vacancy_candidates vc
      JOIN vacancies v ON v.id = vc.vacancy_id
      WHERE v.organization_id = public.get_user_org_id()
    )
  );

-- Communications: access within org
CREATE POLICY "View org communications" ON communications
  FOR SELECT USING (organization_id = public.get_user_org_id());

CREATE POLICY "Insert org communications" ON communications
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());

-- Activity Log: view within org
CREATE POLICY "View org activity" ON activity_log
  FOR SELECT USING (organization_id = public.get_user_org_id());

CREATE POLICY "Insert org activity" ON activity_log
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());

-- Intake Sessions: access via vacancy -> org
CREATE POLICY "View org intake_sessions" ON intake_sessions
  FOR SELECT USING (
    vacancy_id IN (SELECT id FROM vacancies WHERE organization_id = public.get_user_org_id())
  );

CREATE POLICY "Insert org intake_sessions" ON intake_sessions
  FOR INSERT WITH CHECK (
    vacancy_id IN (SELECT id FROM vacancies WHERE organization_id = public.get_user_org_id())
  );

CREATE POLICY "Update org intake_sessions" ON intake_sessions
  FOR UPDATE USING (
    vacancy_id IN (SELECT id FROM vacancies WHERE organization_id = public.get_user_org_id())
  );

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_vacancies_updated_at BEFORE UPDATE ON vacancies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_vacancy_candidates_updated_at BEFORE UPDATE ON vacancy_candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_interviews_updated_at BEFORE UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_intake_sessions_updated_at BEFORE UPDATE ON intake_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'enlace-468';

  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug) VALUES ('Enlace 468', 'enlace-468')
    RETURNING id INTO default_org_id;
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, email, avatar_url, role)
  VALUES (
    NEW.id,
    default_org_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    'recruiter'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED: Default organization
-- ============================================================

INSERT INTO organizations (name, slug) VALUES ('Enlace 468', 'enlace-468')
ON CONFLICT (slug) DO NOTHING;
