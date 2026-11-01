-- ============================================================
-- Entregas: evidencias (archivos) + notas por entrega.
-- Página de detalle estilo Tesipedia (archivos + hilo de notas).
-- Acceso: solo miembros de Entregas (Flavio/Ingrid/Arturo).
-- ============================================================

-- Helper: ¿la entrega pertenece a la org del usuario?
CREATE OR REPLACE FUNCTION public.entrega_en_mi_org(p_entrega_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_entregas ae
    WHERE ae.id = p_entrega_id AND ae.organization_id = public.get_user_org_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------- NOTAS ----------
CREATE TABLE admin_entrega_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid REFERENCES admin_entregas(id) ON DELETE CASCADE NOT NULL,
  texto text NOT NULL,
  autor_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_entrega_notas_entrega ON admin_entrega_notas(entrega_id);

ALTER TABLE admin_entrega_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View entrega_notas" ON admin_entrega_notas
  FOR SELECT USING (public.user_is_entregas_member() AND public.entrega_en_mi_org(entrega_id));
CREATE POLICY "Insert entrega_notas" ON admin_entrega_notas
  FOR INSERT WITH CHECK (public.user_is_entregas_member() AND public.entrega_en_mi_org(entrega_id) AND autor_id = auth.uid());
CREATE POLICY "Delete entrega_notas" ON admin_entrega_notas
  FOR DELETE USING (
    public.user_is_entregas_member() AND public.entrega_en_mi_org(entrega_id)
    AND (autor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  );

-- ---------- EVIDENCIAS (metadatos; el archivo vive en Storage bucket 'documents') ----------
CREATE TABLE admin_entrega_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid REFERENCES admin_entregas(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL,       -- URL pública
  file_path text NOT NULL,      -- ruta en el bucket (para borrar)
  file_name text NOT NULL,
  file_type text,               -- MIME
  size_bytes bigint,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_entrega_evidencias_entrega ON admin_entrega_evidencias(entrega_id);

ALTER TABLE admin_entrega_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View entrega_evidencias" ON admin_entrega_evidencias
  FOR SELECT USING (public.user_is_entregas_member() AND public.entrega_en_mi_org(entrega_id));
CREATE POLICY "Insert entrega_evidencias" ON admin_entrega_evidencias
  FOR INSERT WITH CHECK (public.user_is_entregas_member() AND public.entrega_en_mi_org(entrega_id) AND uploaded_by = auth.uid());
CREATE POLICY "Delete entrega_evidencias" ON admin_entrega_evidencias
  FOR DELETE USING (
    public.user_is_entregas_member() AND public.entrega_en_mi_org(entrega_id)
    AND (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  );
