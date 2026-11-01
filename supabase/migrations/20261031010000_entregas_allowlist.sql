-- ============================================================
-- Entregas: restringir acceso SOLO a Flavio, Ingrid y Arturo
-- (antes: cualquier admin/super_admin, lo que incluía a Karina y Carlos).
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_is_entregas_member()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND lower(email) IN (
        'flavio.rodriguez@grupointegraccion.com',
        'ingrid.escobar@grupointegraccion.com',
        'osvaldosuarezcruz@gmail.com'
      )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recrear políticas usando la allowlist en vez de user_is_admin()
DROP POLICY IF EXISTS "View org admin_entregas" ON admin_entregas;
CREATE POLICY "View org admin_entregas" ON admin_entregas
  FOR SELECT USING (
    organization_id = public.get_user_org_id() AND public.user_is_entregas_member()
  );

DROP POLICY IF EXISTS "Insert org admin_entregas" ON admin_entregas;
CREATE POLICY "Insert org admin_entregas" ON admin_entregas
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_org_id() AND public.user_is_entregas_member()
  );

DROP POLICY IF EXISTS "Update own admin_entregas" ON admin_entregas;
CREATE POLICY "Update own admin_entregas" ON admin_entregas
  FOR UPDATE USING (
    organization_id = public.get_user_org_id() AND public.user_is_entregas_member()
    AND (
      owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Delete own admin_entregas" ON admin_entregas;
CREATE POLICY "Delete own admin_entregas" ON admin_entregas
  FOR DELETE USING (
    organization_id = public.get_user_org_id() AND public.user_is_entregas_member()
    AND (
      owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
  );
