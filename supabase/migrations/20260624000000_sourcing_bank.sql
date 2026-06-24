-- ============================================================
-- Sourcing: saved searches + per-vacancy sourcing bank
-- ============================================================

-- Saved searches (so searches don't disappear), scoped per vacancy
CREATE TABLE sourcing_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  vacancy_id uuid REFERENCES vacancies(id) ON DELETE CASCADE NOT NULL,
  query text NOT NULL,
  platform text DEFAULT 'linkedin',
  label text,
  result_count int,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(vacancy_id, query, platform)
);

-- Sourcing bank: staged web results per vacancy (persistent, separate from pipeline)
CREATE TABLE sourcing_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  vacancy_id uuid REFERENCES vacancies(id) ON DELETE CASCADE NOT NULL,
  title text,
  url text NOT NULL,
  display_url text,
  snippet text,
  platform text,
  source text DEFAULT 'web-sourced',
  full_name text,
  current_title text,
  current_company text,
  notes text,
  candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(vacancy_id, url)
);

CREATE INDEX idx_sourcing_searches_vacancy ON sourcing_searches(vacancy_id);
CREATE INDEX idx_sourcing_bank_vacancy ON sourcing_bank(vacancy_id);

-- ============================================================
-- ROW LEVEL SECURITY (org-scoped, matches existing conventions)
-- ============================================================

ALTER TABLE sourcing_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View org sourcing_searches" ON sourcing_searches
  FOR SELECT USING (organization_id = public.get_user_org_id());
CREATE POLICY "Insert org sourcing_searches" ON sourcing_searches
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());
CREATE POLICY "Update org sourcing_searches" ON sourcing_searches
  FOR UPDATE USING (organization_id = public.get_user_org_id());
CREATE POLICY "Delete org sourcing_searches" ON sourcing_searches
  FOR DELETE USING (organization_id = public.get_user_org_id());

CREATE POLICY "View org sourcing_bank" ON sourcing_bank
  FOR SELECT USING (organization_id = public.get_user_org_id());
CREATE POLICY "Insert org sourcing_bank" ON sourcing_bank
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id());
CREATE POLICY "Update org sourcing_bank" ON sourcing_bank
  FOR UPDATE USING (organization_id = public.get_user_org_id());
CREATE POLICY "Delete org sourcing_bank" ON sourcing_bank
  FOR DELETE USING (organization_id = public.get_user_org_id());
