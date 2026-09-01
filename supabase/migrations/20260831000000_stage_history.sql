-- Historial de transiciones de etapa por candidato-vacante.
-- Feedback de Karina (2026-08-28): los reportes solo mostraban el número final
-- por etapa — no se veía cuántas personas PASARON por entrevista y después
-- fueron rechazadas, avanzaron a 2a entrevista, etc.
--
-- Diseño: un trigger en vacancy_candidates registra TODA transición server-side
-- (drag & drop, modal de contacto, rechazo masivo al contratar…), sin depender
-- de que cada pantalla del cliente inserte su registro. Se backfillea con los
-- ~900 cambios que activity_log ya guardó desde mayo.

create table if not exists stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vacancy_id uuid not null references vacancies(id) on delete cascade,
  vacancy_candidate_id uuid not null references vacancy_candidates(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  performed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists stage_history_vacancy_idx on stage_history (vacancy_id, changed_at);
create index if not exists stage_history_vc_idx on stage_history (vacancy_candidate_id);

alter table stage_history enable row level security;

drop policy if exists "View org stage history" on stage_history;
create policy "View org stage history" on stage_history
  for select using (organization_id = get_user_org_id());

-- El trigger corre como security definer: los clientes solo leen; las
-- inserciones las hace la base al actualizar vacancy_candidates.
create or replace function log_stage_transition() returns trigger
language plpgsql security definer set search_path = public as $$
declare org uuid;
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
  return new;
end $$;

drop trigger if exists trg_stage_history on vacancy_candidates;
create trigger trg_stage_history
  after insert or update of stage on vacancy_candidates
  for each row execute function log_stage_transition();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- 1) Alta inicial de cada candidato que ya está en el pipeline.
insert into stage_history (organization_id, vacancy_id, vacancy_candidate_id, from_stage, to_stage, changed_at)
select v.organization_id, vc.vacancy_id, vc.id, null, 'sourced', vc.created_at
from vacancy_candidates vc
join vacancies v on v.id = vc.vacancy_id
where not exists (select 1 from stage_history sh where sh.vacancy_candidate_id = vc.id);

-- 2) Transiciones históricas que activity_log guardó desde mayo.
insert into stage_history (organization_id, vacancy_id, vacancy_candidate_id, from_stage, to_stage, performed_by, changed_at)
select al.organization_id, vc.vacancy_id, vc.id, null, al.details->>'to_stage', al.performed_by, al.created_at
from activity_log al
join vacancy_candidates vc on vc.id = al.entity_id
where al.entity_type = 'vacancy_candidate'
  and al.details ? 'to_stage'
  and (al.details->>'to_stage') in ('sourced','contacted','screening','interviewing','evaluated','shortlist','presented','offer','hired','rejected')
  and not exists (
    select 1 from stage_history sh
    where sh.vacancy_candidate_id = vc.id
      and sh.to_stage = al.details->>'to_stage'
      and sh.changed_at = al.created_at
  );

-- 3) El stage ACTUAL si ninguna fila lo cubre (p.ej. rechazos masivos al
--    contratar, que no pasaban por activity_log).
insert into stage_history (organization_id, vacancy_id, vacancy_candidate_id, from_stage, to_stage, changed_at)
select v.organization_id, vc.vacancy_id, vc.id, null, vc.stage, coalesce(vc.stage_changed_at, vc.updated_at, now())
from vacancy_candidates vc
join vacancies v on v.id = vc.vacancy_id
where vc.stage <> 'sourced'
  and not exists (select 1 from stage_history sh where sh.vacancy_candidate_id = vc.id and sh.to_stage = vc.stage);
