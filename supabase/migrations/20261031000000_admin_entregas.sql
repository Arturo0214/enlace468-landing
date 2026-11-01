-- ============================================================
-- Entregas administrativas: pendientes/deliverables por admin
-- (Flavio, Ingrid, Arturo). Mismo concepto que el sistema de
-- entregas de Tesipedia, pero compartido entre los 3 admins y
-- vinculado al calendario via due_date.
-- ============================================================

-- Helper: el usuario actual es admin o super_admin de su org
CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE TABLE admin_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,  -- de quien es la entrega
  title text NOT NULL,
  description text,
  due_date date NOT NULL,                                            -- fecha de entrega (se vincula al calendario)
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'en_progreso', 'entregado', 'cancelado')),
  completed_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_admin_entregas_org ON admin_entregas(organization_id);
CREATE INDEX idx_admin_entregas_owner ON admin_entregas(owner_id);
CREATE INDEX idx_admin_entregas_due ON admin_entregas(organization_id, due_date);

CREATE TRIGGER tr_admin_entregas_updated_at BEFORE UPDATE ON admin_entregas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (solo admins de la org; edición del dueño
-- o de cualquier super_admin)
-- ============================================================
ALTER TABLE admin_entregas ENABLE ROW LEVEL SECURITY;

-- Todos los admins de la org ven el tablero compartido de los 3
CREATE POLICY "View org admin_entregas" ON admin_entregas
  FOR SELECT USING (
    organization_id = public.get_user_org_id() AND public.user_is_admin()
  );

-- Cualquier admin crea entregas (propias o delegadas) dentro de su org
CREATE POLICY "Insert org admin_entregas" ON admin_entregas
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_org_id() AND public.user_is_admin()
  );

-- Edita el dueño de la entrega o un super_admin
CREATE POLICY "Update own admin_entregas" ON admin_entregas
  FOR UPDATE USING (
    organization_id = public.get_user_org_id() AND public.user_is_admin()
    AND (
      owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
  );

-- Borra el dueño de la entrega o un super_admin
CREATE POLICY "Delete own admin_entregas" ON admin_entregas
  FOR DELETE USING (
    organization_id = public.get_user_org_id() AND public.user_is_admin()
    AND (
      owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
  );
