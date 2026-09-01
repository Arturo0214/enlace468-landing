-- Blindaje del trigger de historial: si el log fallara por cualquier razón,
-- NUNCA debe bloquear el movimiento de etapa en el pipeline (regla del CRM:
-- el registro es secundario, la operación es primero).
create or replace function log_stage_transition() returns trigger
language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  begin
    select organization_id into org from vacancies where id = new.vacancy_id;
    if org is null then return new; end if;
    if tg_op = 'INSERT' then
      insert into stage_history (organization_id, vacancy_id, vacancy_candidate_id, from_stage, to_stage, changed_at)
      values (org, new.vacancy_id, new.id, null, new.stage, coalesce(new.created_at, now()));
    elsif new.stage is distinct from old.stage then
      insert into stage_history (organization_id, vacancy_id, vacancy_candidate_id, from_stage, to_stage, changed_at)
      values (org, new.vacancy_id, new.id, old.stage, new.stage, now());
    end if;
  exception when others then
    -- swallow: un error de log no debe tirar el drag & drop del reclutador
    null;
  end;
  return new;
end $$;
