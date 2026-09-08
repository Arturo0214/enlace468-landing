-- Endurecimiento de RLS en candidate_interactions (deuda de Fase 0).
--
-- En prod existían DOS policies ALL totalmente permisivas; una de ellas
-- ("Users can manage interactions") aplicaba a {public} con USING(true),
-- es decir CUALQUIER portador del anon key sin sesión podía leer/escribir
-- el timeline completo de interacciones. Se elimina esa policy y la de
-- authenticated se re-scopea a la organización del usuario (mismo patrón
-- org-scoped del resto de las tablas). Los crons usan service role y no
-- pasan por RLS; la extensión Chrome usa sesión authenticated real.
-- Idempotente.

DROP POLICY IF EXISTS "Users can manage interactions" ON candidate_interactions;

DROP POLICY IF EXISTS "Allow all for authenticated" ON candidate_interactions;
CREATE POLICY "Org members manage interactions" ON candidate_interactions
  FOR ALL TO authenticated
  USING (
    vacancy_candidate_id IN (
      SELECT vc.id FROM vacancy_candidates vc
      JOIN vacancies v ON v.id = vc.vacancy_id
      WHERE v.organization_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    vacancy_candidate_id IN (
      SELECT vc.id FROM vacancy_candidates vc
      JOIN vacancies v ON v.id = vc.vacancy_id
      WHERE v.organization_id = public.get_user_org_id()
    )
  );
