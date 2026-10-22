-- Promotion is now evaluated by the system (client chat, Final Revisions PDF pp. 10-11).
-- HR no longer posts promotion criteria. Every active uniformed employee is checked against
-- the fixed requirements of their next rank; qualified personnel appear on the Promotion
-- Evaluation dashboard, where HR approves or rejects. A decision never changes the rank.

-- ---------------------------------------------------------------------------
-- Reference data: required training per rank
-- ---------------------------------------------------------------------------

-- Required training for holding a rank. Used for the next-rank promotion requirement
-- (seeded into promotion_rank_requirements below) and for the current-rank Training Needs
-- report. Names follow src/lib/pnp-catalogue.ts; records are matched by course code.
create or replace function private.rank_required_training(target_rank_code text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case upper(btrim(coalesce(target_rank_code, '')))
    when 'PAT' then array['Public Safety Basic Recruit Course (PSBRC)']
    when 'PCPL' then array['Public Safety Junior Leadership Course (PSJLC)']
    when 'PSSG' then array['Public Safety Junior Leadership Course (PSJLC)']
    when 'PMSG' then array['Public Safety Senior Leadership Course (PSSLC)']
    when 'PSMS' then array['Public Safety Senior Leadership Course (PSSLC)']
    when 'PCMS' then array['Public Safety Senior Leadership Course (PSSLC)']
    when 'PEMS' then array['Public Safety Senior Leadership Course (PSSLC)']
    when 'PLT' then array['Public Safety Officers Basic Course (PSOBC)']
    when 'PCPT' then array['Public Safety Officers Advance Course (PSOAC)']
    when 'PMAJ' then array['Public Safety Officers Advance Course (PSOAC)']
    when 'PLTCOL' then array['Public Safety Officers Senior Executive Course (PSOSEC)']
    when 'PCOL' then array['Public Safety Officers Senior Executive Course (PSOSEC)']
    else array[]::text[]
  end;
$$;

-- The course code in a catalogue name: "Public Safety Officer Basic Course (PSOBC)" -> PSOBC.
-- Matching on the code keeps "Officer"/"Officers" spelling differences between the
-- certification and training catalogues from hiding a completed course.
create or replace function private.training_code(target_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(upper((regexp_match(btrim(coalesce(target_name, '')), '\(([A-Za-z]{2,16})\)\s*$'))[1]), upper(btrim(coalesce(target_name, ''))));
$$;

create or replace function private.iper_level(target_rating text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case target_rating
    when 'Outstanding' then 5
    when 'Very Satisfactory' then 4
    when 'Satisfactory' then 3
    when 'Unsatisfactory' then 2
    when 'Poor' then 1
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- System-owned requirements for each target rank
-- ---------------------------------------------------------------------------

create table public.promotion_rank_requirements (
  target_rank_id bigint primary key references public.ranks(id) on delete cascade,
  min_time_in_grade_months integer not null default 36 check (min_time_in_grade_months between 0 and 600),
  required_training text[] not null default '{}',
  requires_eligibility boolean not null default true,
  min_iper text not null default 'Satisfactory' check (min_iper in ('Outstanding', 'Very Satisfactory', 'Satisfactory', 'Unsatisfactory', 'Poor')),
  iper_period_months integer not null default 12 check (iper_period_months between 1 and 60),
  requires_pft_passed boolean not null default true,
  pft_validity_months integer not null default 12 check (pft_validity_months between 1 and 60),
  updated_at timestamptz not null default now()
);

comment on table public.promotion_rank_requirements is 'System-owned promotion requirements for each target rank. Read-only to app users; HR no longer posts criteria.';

alter table public.promotion_rank_requirements enable row level security;
revoke all on public.promotion_rank_requirements from public, anon, authenticated;
grant select on public.promotion_rank_requirements to authenticated;
grant all on public.promotion_rank_requirements to service_role;
create policy promotion_rank_requirements_select_authenticated on public.promotion_rank_requirements
  for select to authenticated using (true);

-- PDF matrices: the lowest scored seniority row is "3 years 1 day" in grade.
insert into public.promotion_rank_requirements (target_rank_id, min_time_in_grade_months, required_training)
select rank.id, 36, private.rank_required_training(rank.code)
from public.ranks rank
where rank.code in ('PCPL', 'PSSG', 'PMSG', 'PSMS', 'PCMS', 'PEMS', 'PLT', 'PCPT', 'PMAJ', 'PLTCOL', 'PCOL')
on conflict (target_rank_id) do nothing;

-- ---------------------------------------------------------------------------
-- IPER (supervisor's adjectival rating every 6 months) and PFT (passed/failed)
-- ---------------------------------------------------------------------------

alter table public.performance_ratings
  add column rating_kind text not null default 'rubric' check (rating_kind in ('rubric', 'iper'));

comment on column public.performance_ratings.rating_kind is 'iper = supervisor Individual Performance Evaluation Rating entered by HR (adjectival in descriptive_rating); rubric = legacy points rubric.';

create index performance_ratings_iper_idx on public.performance_ratings (employee_id, review_period_ends_on desc) where rating_kind = 'iper';

alter table public.physical_fitness_results
  alter column score drop not null,
  add column result text check (result is null or result in ('passed', 'failed')),
  add constraint physical_fitness_results_score_or_result check (score is not null or result is not null);

-- Unused until now, the restrict foreign key would block account and record deletion.
alter table public.physical_fitness_results
  drop constraint physical_fitness_results_employee_id_fkey,
  add constraint physical_fitness_results_employee_id_fkey foreign key (employee_id) references public.employees(id) on delete cascade;

create or replace function public.record_iper_rating(
  target_employee_id uuid,
  target_starts_on date,
  target_ends_on date,
  target_rating text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  clean_notes text := nullif(btrim(coalesce(target_notes, '')), '');
  iper_value integer := private.iper_level(target_rating);
  new_id uuid;
begin
  if iper_value = 0 then
    raise exception 'Choose an IPER rating: Outstanding, Very Satisfactory, Satisfactory, Unsatisfactory or Poor.' using errcode = '22023';
  end if;
  if target_starts_on is null or target_ends_on is null or target_ends_on < target_starts_on then
    raise exception 'The rating period must end on or after it starts.' using errcode = '22023';
  end if;
  if target_ends_on > (target_starts_on + interval '6 months')::date then
    raise exception 'An IPER rating period covers at most 6 months.' using errcode = '22023';
  end if;
  if clean_notes is not null and char_length(clean_notes) > 2000 then
    raise exception 'Notes must be at most 2000 characters.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.employees where id = target_employee_id and employment_status = 'active') then
    raise exception 'Active employee was not found.' using errcode = 'P0001';
  end if;

  insert into public.performance_ratings (employee_id, rating, review_period_starts_on, review_period_ends_on, notes, descriptive_rating, rating_kind, created_by_user_id, updated_by_user_id)
  values (target_employee_id, iper_value, target_starts_on, target_ends_on, clean_notes, target_rating, 'iper', caller_id, caller_id)
  returning id into new_id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'performance_ratings', new_id::text, 'created', jsonb_build_object('employee_id', target_employee_id, 'kind', 'iper', 'rating', target_rating, 'period_ends_on', target_ends_on));
  return new_id;
end;
$$;

create or replace function public.record_pft_result(
  target_employee_id uuid,
  target_assessed_on date,
  target_passed boolean,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  clean_notes text := nullif(btrim(coalesce(target_notes, '')), '');
  today date := (now() at time zone 'Asia/Manila')::date;
  new_id uuid;
begin
  if target_assessed_on is null or target_assessed_on > today or target_passed is null then
    raise exception 'Enter the PFT date (not in the future) and whether the employee passed.' using errcode = '22023';
  end if;
  if clean_notes is not null and char_length(clean_notes) > 2000 then
    raise exception 'Notes must be at most 2000 characters.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.employees where id = target_employee_id and employment_status = 'active') then
    raise exception 'Active employee was not found.' using errcode = 'P0001';
  end if;

  insert into public.physical_fitness_results (employee_id, score, result, assessed_on, valid_until, notes, recorded_by_user_id)
  values (target_employee_id, null, case when target_passed then 'passed' else 'failed' end, target_assessed_on, (target_assessed_on + interval '12 months' - interval '1 day')::date, clean_notes, caller_id)
  returning id into new_id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'physical_fitness_results', new_id::text, 'created', jsonb_build_object('employee_id', target_employee_id, 'result', case when target_passed then 'passed' else 'failed' end));
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Evaluation
-- ---------------------------------------------------------------------------

-- Next rank on the uniformed ladder: next active rank by sort_order. NUP is non-uniformed.
create or replace function private.next_promotion_rank(target_rank_id bigint)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select next_rank.id
  from public.ranks current_rank
  join public.ranks next_rank on next_rank.is_active and next_rank.sort_order > current_rank.sort_order and next_rank.code <> 'NUP'
  where current_rank.id = target_rank_id and current_rank.code <> 'NUP'
  order by next_rank.sort_order
  limit 1;
$$;

create or replace function private.evaluate_promotion(target_employee_id uuid, target_on date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  on_date date := coalesce(target_on, (now() at time zone 'Asia/Manila')::date);
  employee_row public.employees%rowtype;
  current_rank public.ranks%rowtype;
  target_rank public.ranks%rowtype;
  requirement public.promotion_rank_requirements%rowtype;
  min_tig integer; training text[]; needs_eligibility boolean; min_iper text; iper_months integer; needs_pft boolean; pft_months integer;
  rank_since date; tig_months integer; age_value interval;
  training_name text; matched jsonb; trainings jsonb := '[]'::jsonb;
  eligibility_record jsonb; iper_record jsonb; pft_record jsonb;
  met boolean; requirements jsonb := '[]'::jsonb; missing jsonb := '[]'::jsonb; label text;
  base jsonb;
begin
  select * into employee_row from public.employees where id = target_employee_id;
  if employee_row.id is null then return null; end if;
  select * into current_rank from public.ranks where id = employee_row.rank_id;

  base := jsonb_build_object(
    'employeeId', employee_row.id,
    'employeeName', concat_ws(', ', employee_row.last_name, employee_row.first_name),
    'employeeNumber', employee_row.employee_number,
    'evaluatedOn', on_date,
    'isUniformed', current_rank.id is not null and current_rank.code <> 'NUP',
    'currentRank', case when current_rank.id is null then null else jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name) end
  );

  if current_rank.id is not null then
    select * into target_rank from public.ranks where id = private.next_promotion_rank(current_rank.id);
  end if;
  if target_rank.id is null or employee_row.employment_status <> 'active' then
    return base || jsonb_build_object('targetRank', null, 'isQualified', false, 'requirements', '[]'::jsonb, 'missingRequirements', '[]'::jsonb,
      'reason', case when employee_row.employment_status <> 'active' then 'inactive' when current_rank.id is null then 'no_rank' when current_rank.code = 'NUP' then 'non_uniformed' else 'top_rank' end);
  end if;

  select * into requirement from public.promotion_rank_requirements where target_rank_id = target_rank.id;
  min_tig := coalesce(requirement.min_time_in_grade_months, 36);
  training := coalesce(requirement.required_training, private.rank_required_training(target_rank.code));
  needs_eligibility := coalesce(requirement.requires_eligibility, true);
  min_iper := coalesce(requirement.min_iper, 'Satisfactory');
  iper_months := coalesce(requirement.iper_period_months, 12);
  needs_pft := coalesce(requirement.requires_pft_passed, true);
  pft_months := coalesce(requirement.pft_validity_months, 12);

  -- Time in grade: since the employee first held the current rank in service history,
  -- otherwise since employment started (same rule as the previous readiness check).
  select min(history.started_on) into rank_since from public.service_history history
  where history.employee_id = employee_row.id and history.rank_id = current_rank.id and history.started_on <= on_date;
  rank_since := coalesce(rank_since, employee_row.employment_started_on);
  age_value := age(on_date, rank_since);
  tig_months := greatest(0, (extract(year from age_value) * 12 + extract(month from age_value))::integer);

  met := tig_months >= min_tig;
  label := 'Time in grade (' || min_tig || ' months as ' || current_rank.code || ')';
  requirements := requirements || jsonb_build_array(jsonb_build_object('key', 'time_in_grade', 'label', label, 'met', met));
  if not met then missing := missing || to_jsonb(label); end if;

  foreach training_name in array training loop
    select to_jsonb(match_row) into matched from (
      select 'certification' as "recordKind", certification.id as "recordId", certification.name as "recordName", certification.issued_on as "completedOn",
        certification.document_path as "documentPath", certification.document_name as "documentName"
      from public.certifications certification
      where certification.employee_id = employee_row.id and private.training_code(certification.name) = private.training_code(training_name)
        and certification.issued_on <= on_date and (certification.expires_on is null or certification.expires_on >= on_date)
      union all
      select 'training', record.id, record.course_name, record.completed_on, null, null
      from public.training_records record
      where record.employee_id = employee_row.id and private.training_code(record.course_name) = private.training_code(training_name)
        and record.completed_on <= on_date and (record.expires_on is null or record.expires_on >= on_date)
      order by 4 desc
      limit 1
    ) match_row;
    met := matched is not null;
    label := 'Training: ' || training_name;
    trainings := trainings || jsonb_build_array(jsonb_build_object('name', training_name, 'code', private.training_code(training_name), 'met', met, 'record', matched));
    requirements := requirements || jsonb_build_array(jsonb_build_object('key', 'training:' || private.training_code(training_name), 'label', label, 'met', met));
    if not met then missing := missing || to_jsonb(label); end if;
  end loop;

  -- Eligibility (e.g. NAPOLCOM). Any recorded eligibility qualifies; its rating is shown, not scored.
  -- The rating column arrives in a separate migration, so it is read through to_jsonb.
  select jsonb_build_object('id', q.id, 'name', q.name, 'rating', to_jsonb(q) ->> 'rating', 'awardedOn', q.awarded_on, 'documentPath', q.document_path, 'documentName', q.document_name)
  into eligibility_record
  from public.qualifications q
  where q.employee_id = employee_row.id
  order by (to_jsonb(q) ->> 'rating') is null, q.awarded_on desc, q.created_at desc
  limit 1;
  if needs_eligibility then
    met := eligibility_record is not null;
    label := 'Eligibility (e.g. NAPOLCOM) with rating';
    requirements := requirements || jsonb_build_array(jsonb_build_object('key', 'eligibility', 'label', label, 'met', met));
    if not met then missing := missing || to_jsonb(label); end if;
  end if;

  select jsonb_build_object('id', rating.id, 'rating', rating.descriptive_rating, 'periodStartsOn', rating.review_period_starts_on, 'periodEndsOn', rating.review_period_ends_on)
  into iper_record
  from public.performance_ratings rating
  where rating.employee_id = employee_row.id and rating.rating_kind = 'iper'
    and rating.review_period_ends_on <= on_date and rating.review_period_ends_on > (on_date - make_interval(months => iper_months))::date
  order by rating.review_period_ends_on desc, rating.created_at desc
  limit 1;
  met := iper_record is not null and private.iper_level(iper_record ->> 'rating') >= private.iper_level(min_iper);
  label := 'IPER: ' || min_iper || ' or better (last ' || iper_months || ' months)';
  requirements := requirements || jsonb_build_array(jsonb_build_object('key', 'iper', 'label', label, 'met', met));
  if not met then missing := missing || to_jsonb(label); end if;

  select jsonb_build_object('id', result.id, 'result', coalesce(result.result, case when result.score is not null then 'scored' end), 'score', result.score, 'assessedOn', result.assessed_on)
  into pft_record
  from public.physical_fitness_results result
  where result.employee_id = employee_row.id
    and result.assessed_on <= on_date and result.assessed_on > (on_date - make_interval(months => pft_months))::date
  order by result.assessed_on desc, result.created_at desc
  limit 1;
  if needs_pft then
    met := coalesce(pft_record ->> 'result', '') = 'passed';
    label := 'PFT: Passed (last ' || pft_months || ' months)';
    requirements := requirements || jsonb_build_array(jsonb_build_object('key', 'pft', 'label', label, 'met', met));
    if not met then missing := missing || to_jsonb(label); end if;
  end if;

  return base || jsonb_build_object(
    'targetRank', jsonb_build_object('id', target_rank.id, 'code', target_rank.code, 'name', target_rank.name),
    'rankSince', rank_since,
    'timeInGradeMonths', tig_months,
    'minimumTimeInGradeMonths', min_tig,
    'trainings', trainings,
    'eligibility', jsonb_build_object('required', needs_eligibility, 'record', eligibility_record),
    'iper', jsonb_build_object('minimum', min_iper, 'periodMonths', iper_months, 'record', iper_record),
    'pft', jsonb_build_object('required', needs_pft, 'validityMonths', pft_months, 'record', pft_record),
    'requirements', requirements,
    'missingRequirements', missing,
    'isQualified', jsonb_array_length(missing) = 0,
    'reason', null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- HR decisions
-- ---------------------------------------------------------------------------

create table public.promotion_decisions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  from_rank_id bigint references public.ranks(id) on delete set null,
  target_rank_id bigint not null references public.ranks(id) on delete cascade,
  status text not null check (status in ('approved', 'rejected')),
  remarks text check (remarks is null or (remarks = btrim(remarks) and char_length(remarks) between 1 and 2000)),
  evaluation_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(evaluation_snapshot) = 'object'),
  decided_by_user_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  unique (employee_id, target_rank_id)
);

comment on table public.promotion_decisions is 'HR approve/reject decision on a system-evaluated promotion to target_rank_id. Approval does not change the rank.';

create index promotion_decisions_target_status_idx on public.promotion_decisions (target_rank_id, status, decided_at desc);
create index promotion_decisions_decided_idx on public.promotion_decisions (decided_at desc);

alter table public.promotion_decisions enable row level security;
revoke all on public.promotion_decisions from public, anon, authenticated;
grant select on public.promotion_decisions to authenticated;
grant all on public.promotion_decisions to service_role;
create policy promotion_decisions_select_hr_or_own on public.promotion_decisions for select to authenticated using (
  (select private.current_user_has_role('hr_personnel'::public.app_role))
  or exists (select 1 from public.employees where employees.id = promotion_decisions.employee_id and employees.profile_id = (select auth.uid()))
);

create or replace function public.decide_promotion(target_employee_id uuid, target_approve boolean, target_remarks text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  clean_remarks text := nullif(btrim(coalesce(target_remarks, '')), '');
  evaluation jsonb;
  target_rank_value bigint;
  employee_row public.employees%rowtype;
  decision_id uuid;
  decision_status text := case when target_approve then 'approved' else 'rejected' end;
begin
  if target_approve is null then raise exception 'Choose approve or reject.' using errcode = '22023'; end if;
  if clean_remarks is not null and char_length(clean_remarks) > 2000 then raise exception 'Remarks must be at most 2000 characters.' using errcode = '22023'; end if;
  if not target_approve and clean_remarks is null then raise exception 'Enter the reason for rejecting this promotion.' using errcode = '22023'; end if;

  select * into employee_row from public.employees where id = target_employee_id for update;
  if employee_row.id is null then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  evaluation := private.evaluate_promotion(target_employee_id);
  if evaluation -> 'targetRank' is null or jsonb_typeof(evaluation -> 'targetRank') = 'null' then
    raise exception 'This employee has no next rank on the uniformed promotion ladder.' using errcode = 'P0001';
  end if;
  target_rank_value := (evaluation -> 'targetRank' ->> 'id')::bigint;
  if exists (select 1 from public.promotion_decisions where employee_id = target_employee_id and target_rank_id = target_rank_value) then
    raise exception 'A decision for this promotion was already recorded.' using errcode = '23505';
  end if;
  if target_approve and not (evaluation ->> 'isQualified')::boolean then
    raise exception 'The employee does not meet every requirement for %. Reject it with the missing requirements instead.', evaluation -> 'targetRank' ->> 'code' using errcode = 'P0001';
  end if;

  insert into public.promotion_decisions (employee_id, from_rank_id, target_rank_id, status, remarks, evaluation_snapshot, decided_by_user_id)
  values (target_employee_id, employee_row.rank_id, target_rank_value, decision_status, clean_remarks, evaluation, caller_id)
  returning id into decision_id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'promotion_decisions', decision_id::text, decision_status, jsonb_build_object('employee_id', target_employee_id, 'from_rank_id', employee_row.rank_id, 'target_rank_id', target_rank_value));

  if employee_row.profile_id is not null then
    insert into public.notifications (recipient_user_id, type, title, body, link)
    values (
      employee_row.profile_id,
      'promotion_decision',
      case when target_approve then 'Promotion approved' else 'Promotion not approved' end,
      case when target_approve
        then 'HR approved your promotion to ' || (evaluation -> 'targetRank' ->> 'name') || '. Your rank is updated once HR records it in your personnel file.'
        else 'HR did not approve your promotion to ' || (evaluation -> 'targetRank' ->> 'name') || '. Reason: ' || left(clean_remarks, 1500)
      end,
      '/employee/promotion-eligibility'
    );
  end if;
  return decision_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read RPCs
-- ---------------------------------------------------------------------------

create or replace function private.promotion_decision_json(target_employee_id uuid, target_rank_value bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', decision.id, 'status', decision.status, 'remarks', decision.remarks, 'decidedAt', decision.decided_at, 'targetRankId', decision.target_rank_id)
  from public.promotion_decisions decision
  where decision.employee_id = target_employee_id and decision.target_rank_id = target_rank_value;
$$;

-- Dashboard: qualified personnel without a decision (for_approval) plus decided promotions
-- for each employee's current target rank.
create or replace function public.list_promotion_candidates_page(
  target_search text default null,
  target_status text default null,
  target_page integer default 1,
  target_page_size integer default 25,
  target_employee_id uuid default null
)
returns table (
  employee_id uuid,
  employee_name text,
  employee_number text,
  rank_id bigint,
  rank_code text,
  rank_name text,
  target_rank_id bigint,
  target_rank_code text,
  target_rank_name text,
  status text,
  decision_id uuid,
  remarks text,
  decided_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(target_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(target_page_size, 25), 1), 100);
  terms text[] := (
    select coalesce(array_agg(term), '{}')
    from (select term from regexp_split_to_table(lower(btrim(coalesce(target_search, ''))), '\s+') term where term <> '' limit 6) words
  );
begin
  perform private.require_active_hr();
  if target_status is not null and target_status not in ('for_approval', 'approved', 'rejected') then
    raise exception 'Unknown promotion status.' using errcode = '22023';
  end if;
  return query
  with ladder as (
    select employee.id, employee.employee_number, concat_ws(', ', employee.last_name, employee.first_name) as full_name,
      current_rank.id as current_rank_id, current_rank.code as current_rank_code, current_rank.name as current_rank_name,
      target_rank.id as next_rank_id, target_rank.code as next_rank_code, target_rank.name as next_rank_name,
      lower(concat_ws(' ', public.search_text(employee), current_rank.code, current_rank.name, target_rank.code, target_rank.name)) as haystack
    from public.employees employee
    join public.ranks current_rank on current_rank.id = employee.rank_id and current_rank.code <> 'NUP'
    join public.ranks target_rank on target_rank.id = private.next_promotion_rank(current_rank.id)
    where employee.employment_status = 'active'
      and (target_employee_id is null or employee.id = target_employee_id)
  ), candidates as (
    select ladder.*, decision.id as row_decision_id, decision.status as decision_status, decision.remarks as decision_remarks, decision.decided_at as decision_decided_at
    from ladder
    left join public.promotion_decisions decision on decision.employee_id = ladder.id and decision.target_rank_id = ladder.next_rank_id
    where not exists (select 1 from unnest(terms) term where strpos(ladder.haystack, term) = 0)
  ), listed as (
    select candidates.*, coalesce(candidates.decision_status, 'for_approval') as row_status
    from candidates
    where candidates.row_decision_id is not null
       or (private.evaluate_promotion(candidates.id) ->> 'isQualified')::boolean
  )
  select listed.id, listed.full_name, listed.employee_number, listed.current_rank_id, listed.current_rank_code, listed.current_rank_name,
    listed.next_rank_id, listed.next_rank_code, listed.next_rank_name, listed.row_status, listed.row_decision_id, listed.decision_remarks,
    listed.decision_decided_at, count(*) over() as total_count
  from listed
  where target_status is null or listed.row_status = target_status
  order by (listed.row_status = 'for_approval') desc, listed.decision_decided_at desc nulls last, listed.full_name, listed.id
  offset (safe_page - 1) * safe_page_size limit safe_page_size;
end;
$$;

create or replace function public.get_promotion_evaluation(target_employee_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  evaluation jsonb;
begin
  perform private.require_active_hr();
  evaluation := private.evaluate_promotion(target_employee_id);
  if evaluation is null then return null; end if;
  return jsonb_build_object(
    'evaluation', evaluation,
    'decision', case when jsonb_typeof(evaluation -> 'targetRank') = 'object' then private.promotion_decision_json(target_employee_id, (evaluation -> 'targetRank' ->> 'id')::bigint) end
  );
end;
$$;

create or replace function public.get_my_promotion_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  own_employee_id uuid := private.require_active_employee_self();
  evaluation jsonb := private.evaluate_promotion(own_employee_id);
begin
  return jsonb_build_object(
    'evaluation', evaluation,
    'decision', case when jsonb_typeof(evaluation -> 'targetRank') = 'object' then private.promotion_decision_json(own_employee_id, (evaluation -> 'targetRank' ->> 'id')::bigint) end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('id', decision.id, 'status', decision.status, 'remarks', decision.remarks, 'decidedAt', decision.decided_at,
        'targetRankCode', rank.code, 'targetRankName', rank.name) order by decision.decided_at desc)
      from public.promotion_decisions decision join public.ranks rank on rank.id = decision.target_rank_id
      where decision.employee_id = own_employee_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. HR no longer creates criteria or receives dockets; the tables stay for history.
-- ---------------------------------------------------------------------------

revoke all on function private.rank_required_training(text), private.training_code(text), private.iper_level(text),
  private.next_promotion_rank(bigint), private.evaluate_promotion(uuid, date), private.promotion_decision_json(uuid, bigint)
  from public, anon, authenticated;

revoke all on function public.record_iper_rating(uuid, date, date, text, text), public.record_pft_result(uuid, date, boolean, text),
  public.decide_promotion(uuid, boolean, text), public.list_promotion_candidates_page(text, text, integer, integer, uuid),
  public.get_promotion_evaluation(uuid), public.get_my_promotion_status()
  from public, anon;
grant execute on function public.record_iper_rating(uuid, date, date, text, text), public.record_pft_result(uuid, date, boolean, text),
  public.decide_promotion(uuid, boolean, text), public.list_promotion_candidates_page(text, text, integer, integer, uuid),
  public.get_promotion_evaluation(uuid), public.get_my_promotion_status()
  to authenticated, service_role;

revoke execute on function public.create_promotion_criterion(integer, integer, integer, jsonb),
  public.create_promotion_criterion(integer, integer, integer, jsonb, integer, integer, numeric, integer),
  public.update_promotion_criterion(uuid, timestamp with time zone, integer, integer, integer, boolean, jsonb),
  public.set_promotion_criterion_active(uuid, boolean),
  public.delete_promotion_criterion(uuid),
  public.submit_employee_promotion_docket(uuid, text)
  from public, anon, authenticated;
