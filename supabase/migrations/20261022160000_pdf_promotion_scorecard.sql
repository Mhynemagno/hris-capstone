-- Complete system-owned promotion scorecard transcribed from Final Revisions.pdf pp. 18-20.
-- This helper is deliberately private: public read RPCs authorize HR before exposing results.

create table public.promotion_assignment_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  assignment_kind text not null check (assignment_kind in ('field_or_quad', 'administrative', 'geographic')),
  region text check (region is null or region in ('Luzon', 'Visayas', 'Mindanao')),
  started_on date not null,
  ended_on date not null,
  evidence text not null check (evidence = btrim(evidence) and char_length(evidence) between 1 and 2000),
  recorded_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_on >= started_on),
  check ((assignment_kind = 'geographic') = (region is not null))
);
create index promotion_assignment_records_employee_dates_idx on public.promotion_assignment_records (employee_id, assignment_kind, started_on, ended_on);
alter table public.promotion_assignment_records enable row level security;
revoke all on public.promotion_assignment_records from public, anon, authenticated;
grant all on public.promotion_assignment_records to service_role;

create table public.promotion_award_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  award_key text not null check (award_key in ('medalya_ng_kagitingan', 'medalya_ng_kabayanihan', 'medalya_ng_katapangan', 'medalya_ng_kadakilaan', 'medalya_ng_kagalingan', 'medalya_ng_sugat_na_magiting', 'medalya_ng_papuri', 'medalya_ng_katapatan_sa_paglingkod', 'medalya_ng_katangi_tanging_gawa', 'medalya_ng_pambihirang_paglingkod', 'medalya_ng_kasanayan', 'medalya_ng_paglingkod', 'medalya_ng_mabuting_asal', 'medalya_ng_pagtulong_sa_nasalanta', 'tsapa_ng_natatanging_yunit', 'medalya_ng_ugnayang_pampublisya', 'medalya_ng_paglingkod_sa_luzon_visayas_mindanao', 'tsapa_ng_kwalipikasyon', 'commendation')),
  awarded_on date not null,
  present_rank_id bigint not null references public.ranks(id) on delete restrict,
  evidence text not null check (evidence = btrim(evidence) and char_length(evidence) between 1 and 2000),
  recorded_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index promotion_award_records_employee_rank_idx on public.promotion_award_records (employee_id, present_rank_id, awarded_on desc);
alter table public.promotion_award_records enable row level security;
revoke all on public.promotion_award_records from public, anon, authenticated;
grant all on public.promotion_award_records to service_role;

create table public.promotion_board_assessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  criterion text not null check (criterion in ('board', 'reputation')),
  band text not null check (band in ('PCPL-PMSG', 'PSMS-PEMS', 'PLT-PLTCOL')),
  assessed_on date not null,
  score numeric(5,2) not null check (score >= 0),
  evidence text not null check (evidence = btrim(evidence) and char_length(evidence) between 1 and 2000),
  recorded_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  check ((band = 'PCPL-PMSG' and ((criterion = 'board' and score <= 15) or (criterion = 'reputation' and score <= 20))) or (band in ('PSMS-PEMS', 'PLT-PLTCOL') and ((criterion = 'board' and score <= 10) or (criterion = 'reputation' and score <= 25))))
);
create index promotion_board_assessments_employee_band_idx on public.promotion_board_assessments (employee_id, band, criterion, assessed_on desc);
alter table public.promotion_board_assessments enable row level security;
revoke all on public.promotion_board_assessments from public, anon, authenticated;
grant all on public.promotion_board_assessments to service_role;

create or replace function private.promotion_scorecard_band(target_rank_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(btrim(coalesce(target_rank_code, '')))
    when 'PCPL' then 'PCPL-PMSG'
    when 'PSSG' then 'PCPL-PMSG'
    when 'PMSG' then 'PCPL-PMSG'
    when 'PSMS' then 'PSMS-PEMS'
    when 'PCMS' then 'PSMS-PEMS'
    when 'PEMS' then 'PSMS-PEMS'
    when 'PLT' then 'PLT-PLTCOL'
    when 'PCPT' then 'PLT-PLTCOL'
    when 'PMAJ' then 'PLT-PLTCOL'
    when 'PLTCOL' then 'PLT-PLTCOL'
    else null
  end;
$$;

create or replace function private.evaluate_promotion_scorecard(target_employee_id uuid, target_on date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  on_date date := coalesce(target_on, current_date);
  employee_row public.employees%rowtype;
  current_rank public.ranks%rowtype;
  target_rank public.ranks%rowtype;
  rank_since date;
  scorecard_band text;
  seniority_points numeric := 0;
  assignment_points numeric := 0;
  award_points numeric := 0;
  iper_points numeric := 0;
  board_points numeric := 0;
  reputation_points numeric := 0;
  allocation jsonb;
  criteria jsonb;
  eligibility_record jsonb;
  board_record jsonb;
  reputation_record jsonb;
  iper_ratings text[];
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
    'isUniformed', current_rank.id is not null and current_rank.code <> 'NUP'
  );
  if employee_row.employment_status <> 'active' then
    return base || jsonb_build_object('currentRank', null, 'targetRank', null, 'reason', 'inactive');
  end if;
  if current_rank.id is null then
    return base || jsonb_build_object('currentRank', null, 'targetRank', null, 'reason', 'no_rank');
  end if;
  if current_rank.code = 'NUP' then
    return base || jsonb_build_object('currentRank', jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name), 'targetRank', null, 'reason', 'non_uniformed');
  end if;
  scorecard_band := private.promotion_scorecard_band(current_rank.code);
  if scorecard_band is null then
    return base || jsonb_build_object('currentRank', jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name), 'targetRank', null, 'reason', 'below_scored_rank');
  end if;
  select * into target_rank from public.ranks where id = private.next_promotion_rank(current_rank.id);
  if target_rank.id is null then
    return base || jsonb_build_object('currentRank', jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name), 'targetRank', null, 'reason', 'top_rank');
  end if;

  select min(history.started_on) into rank_since
  from public.service_history history
  where history.employee_id = employee_row.id and history.rank_id = current_rank.id and history.started_on <= on_date;
  rank_since := coalesce(rank_since, employee_row.employment_started_on);

  select coalesce(max(row.points), 0) into seniority_points
  from (
    select * from (values
      ('PCPL-PMSG'::text, 3, 0, 1, 15::numeric), ('PCPL-PMSG', 3, 6, 1, 16::numeric), ('PCPL-PMSG', 4, 0, 1, 17::numeric),
      ('PCPL-PMSG', 4, 6, 1, 18::numeric), ('PCPL-PMSG', 5, 0, 1, 20::numeric), ('PCPL-PMSG', 5, 6, 1, 22::numeric),
      ('PCPL-PMSG', 6, 0, 1, 24::numeric), ('PCPL-PMSG', 6, 6, 1, 26::numeric), ('PCPL-PMSG', 7, 0, 1, 28::numeric), ('PCPL-PMSG', 7, 6, 1, 30::numeric),
      ('PSMS-PEMS', 3, 0, 1, 15::numeric), ('PSMS-PEMS', 3, 6, 1, 16::numeric), ('PSMS-PEMS', 4, 0, 1, 17::numeric),
      ('PSMS-PEMS', 4, 6, 1, 18::numeric), ('PSMS-PEMS', 5, 0, 1, 20::numeric), ('PSMS-PEMS', 5, 6, 1, 21::numeric),
      ('PSMS-PEMS', 6, 0, 1, 22::numeric), ('PSMS-PEMS', 6, 6, 1, 23::numeric), ('PSMS-PEMS', 7, 0, 0, 25::numeric),
      ('PLT-PLTCOL', 3, 0, 1, 15::numeric), ('PLT-PLTCOL', 3, 6, 1, 16::numeric), ('PLT-PLTCOL', 4, 0, 1, 17::numeric),
      ('PLT-PLTCOL', 4, 6, 1, 18::numeric), ('PLT-PLTCOL', 5, 0, 1, 20::numeric), ('PLT-PLTCOL', 5, 6, 1, 21::numeric),
      ('PLT-PLTCOL', 6, 0, 1, 22::numeric), ('PLT-PLTCOL', 6, 6, 1, 23::numeric), ('PLT-PLTCOL', 7, 0, 0, 25::numeric)
    ) as valueset(score_band, years, months, days, points)
  ) row
  where row.score_band = scorecard_band and on_date >= rank_since + make_interval(years => row.years, months => row.months, days => row.days);

  allocation := case scorecard_band
    when 'PCPL-PMSG' then jsonb_build_object('seniority', 30, 'assignment', 20, 'awards', 10, 'iper', 5, 'board', 15, 'reputation', 20)
    else jsonb_build_object('seniority', 25, 'assignment', 25, 'awards', 10, 'iper', 5, 'board', 10, 'reputation', 25)
  end;

  select least(10, coalesce(sum(case when record.assignment_kind = 'field_or_quad' then floor((extract(year from age(record.ended_on + 1, record.started_on)) * 12 + extract(month from age(record.ended_on + 1, record.started_on))) / 6) else 0 end), 0))
       + least(10, coalesce(sum(case when record.assignment_kind = 'administrative' then floor((extract(year from age(record.ended_on + 1, record.started_on)) * 12 + extract(month from age(record.ended_on + 1, record.started_on))) / 6) else 0 end), 0))
       + case when scorecard_band = 'PCPL-PMSG' then 0 else least(1.5, coalesce(sum(case when record.assignment_kind = 'geographic' and record.region in ('Luzon', 'Visayas') then floor((extract(year from age(record.ended_on + 1, record.started_on)) * 12 + extract(month from age(record.ended_on + 1, record.started_on))) / 6) * 0.75 else 0 end), 0)) + least(2, coalesce(sum(case when record.assignment_kind = 'geographic' and record.region = 'Mindanao' then floor((extract(year from age(record.ended_on + 1, record.started_on)) * 12 + extract(month from age(record.ended_on + 1, record.started_on))) / 6) else 0 end), 0)) end
  into assignment_points
  from public.promotion_assignment_records record
  where record.employee_id = employee_row.id and record.ended_on <= on_date;
  assignment_points := least((allocation ->> 'assignment')::numeric, assignment_points);

  select least(10, coalesce(sum(case record.award_key
    when 'medalya_ng_kagitingan' then 10 when 'medalya_ng_kabayanihan' then 8 when 'medalya_ng_katapangan' then 5
    when 'medalya_ng_kadakilaan' then 3 when 'medalya_ng_kagalingan' then 3 when 'medalya_ng_sugat_na_magiting' then 2
    when 'medalya_ng_papuri' then 1 when 'medalya_ng_katapatan_sa_paglingkod' then 5 when 'medalya_ng_katangi_tanging_gawa' then 4
    when 'medalya_ng_pambihirang_paglingkod' then 3 when 'medalya_ng_kasanayan' then 2 when 'medalya_ng_paglingkod' then 3
    when 'medalya_ng_mabuting_asal' then 2 when 'medalya_ng_pagtulong_sa_nasalanta' then 2 when 'tsapa_ng_natatanging_yunit' then 1
    when 'medalya_ng_ugnayang_pampublisya' then 1 when 'medalya_ng_paglingkod_sa_luzon_visayas_mindanao' then 1
    when 'tsapa_ng_kwalipikasyon' then 0.5 when 'commendation' then 0.2 else 0 end), 0))
  into award_points
  from public.promotion_award_records record
  where record.employee_id = employee_row.id and record.present_rank_id = current_rank.id and record.awarded_on <= on_date;

  select array_agg(rating.descriptive_rating order by rating.review_period_ends_on desc) into iper_ratings
  from (select descriptive_rating, review_period_ends_on from public.performance_ratings where employee_id = employee_row.id and rating_kind = 'iper' and review_period_ends_on <= on_date order by review_period_ends_on desc limit 2) rating;
  iper_points := case
    when coalesce(iper_ratings[1], '') = 'Outstanding' and coalesce(iper_ratings[2], '') = 'Outstanding' then 5
    when 'Outstanding' = any(iper_ratings) and 'Very Satisfactory' = any(iper_ratings) then 3.5
    when coalesce(iper_ratings[1], '') = 'Very Satisfactory' and coalesce(iper_ratings[2], '') = 'Very Satisfactory' then 2
    else 0 end;

  select jsonb_build_object('id', assessment.id, 'score', assessment.score, 'assessedOn', assessment.assessed_on, 'evidence', assessment.evidence) into board_record
  from public.promotion_board_assessments assessment where assessment.employee_id = employee_row.id and assessment.band = scorecard_band and assessment.criterion = 'board' and assessment.assessed_on <= on_date order by assessment.assessed_on desc, assessment.created_at desc limit 1;
  board_points := coalesce((board_record ->> 'score')::numeric, 0);
  select jsonb_build_object('id', assessment.id, 'score', assessment.score, 'assessedOn', assessment.assessed_on, 'evidence', assessment.evidence) into reputation_record
  from public.promotion_board_assessments assessment where assessment.employee_id = employee_row.id and assessment.band = scorecard_band and assessment.criterion = 'reputation' and assessment.assessed_on <= on_date order by assessment.assessed_on desc, assessment.created_at desc limit 1;
  reputation_points := coalesce((reputation_record ->> 'score')::numeric, 0);

  criteria := jsonb_build_array(
    jsonb_build_object('key', 'seniority', 'label', 'Seniority / time in grade', 'points', seniority_points, 'maximumPoints', allocation -> 'seniority', 'state', 'calculated', 'evidence', jsonb_build_object('rankSince', rank_since)),
    jsonb_build_object('key', 'assignment', 'label', 'Diversity of assignment', 'points', assignment_points, 'maximumPoints', allocation -> 'assignment', 'state', case when assignment_points = 0 then 'missing' else 'calculated' end, 'evidence', '[]'::jsonb),
    jsonb_build_object('key', 'awards', 'label', 'Awards and recognition', 'points', award_points, 'maximumPoints', allocation -> 'awards', 'state', case when award_points = 0 then 'missing' else 'calculated' end, 'evidence', '[]'::jsonb),
    jsonb_build_object('key', 'iper', 'label', 'IPER', 'points', iper_points, 'maximumPoints', allocation -> 'iper', 'state', case when cardinality(iper_ratings) < 2 then 'missing' else 'calculated' end, 'evidence', coalesce(to_jsonb(iper_ratings), '[]'::jsonb)),
    jsonb_build_object('key', 'board', 'label', case when scorecard_band = 'PCPL-PMSG' then 'Interview' else 'Competence to assume position / leadership experience' end, 'points', board_points, 'maximumPoints', allocation -> 'board', 'state', case when board_record is null then 'unassessed' else 'assessed' end, 'evidence', coalesce(board_record, 'null'::jsonb)),
    jsonb_build_object('key', 'reputation', 'label', 'Service reputation', 'points', reputation_points, 'maximumPoints', allocation -> 'reputation', 'state', case when reputation_record is null then 'unassessed' else 'assessed' end, 'evidence', coalesce(reputation_record, 'null'::jsonb))
  );
  select jsonb_build_object('id', qualification.id, 'name', qualification.name, 'rating', qualification.rating::text, 'awardedOn', qualification.awarded_on, 'documentPath', qualification.document_path, 'documentName', qualification.document_name)
  into eligibility_record
  from public.qualifications qualification
  where qualification.employee_id = employee_row.id
  order by qualification.awarded_on desc, qualification.created_at desc
  limit 1;

  return base || jsonb_build_object(
    'band', scorecard_band, 'totalScore', trim_scale(seniority_points + assignment_points + award_points + iper_points + board_points + reputation_points), 'maximumScore', 100,
    'criteria', criteria,
    'eligibility', jsonb_build_object('record', eligibility_record),
    'currentRank', jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name),
    'targetRank', jsonb_build_object('id', target_rank.id, 'code', target_rank.code, 'name', target_rank.name),
    'reason', null
  );
end;
$$;

revoke all on function private.promotion_scorecard_band(text), private.evaluate_promotion_scorecard(uuid, date) from public, anon, authenticated;

create or replace function public.record_promotion_assignment(target_employee_id uuid, target_kind text, target_region text, target_starts_on date, target_ends_on date, target_evidence text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  record_id uuid;
  clean_kind text := btrim(coalesce(target_kind, ''));
  clean_region text := nullif(btrim(coalesce(target_region, '')), '');
  clean_evidence text := btrim(coalesce(target_evidence, ''));
begin
  if target_starts_on is null or target_ends_on is null or target_ends_on < target_starts_on then raise exception 'The assignment must end on or after it starts.' using errcode = '22023'; end if;
  if clean_kind not in ('field_or_quad', 'administrative', 'geographic') then raise exception 'Choose an official assignment type.' using errcode = '22023'; end if;
  if (clean_kind = 'geographic') <> (clean_region is not null) then raise exception 'Only geographical assignments require a region.' using errcode = '22023'; end if;
  if clean_region is not null and clean_region not in ('Luzon', 'Visayas', 'Mindanao') then raise exception 'Choose Luzon, Visayas, or Mindanao.' using errcode = '22023'; end if;
  if char_length(clean_evidence) not between 1 and 2000 then raise exception 'Enter supporting evidence up to 2000 characters.' using errcode = '22023'; end if;
  perform 1 from public.employees where id = target_employee_id for update;
  if not found then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.promotion_assignment_records record where record.employee_id = target_employee_id and record.assignment_kind = clean_kind and record.region is not distinct from clean_region and daterange(record.started_on, record.ended_on, '[]') && daterange(target_starts_on, target_ends_on, '[]')) then raise exception 'This assignment overlaps an existing record.' using errcode = '23505'; end if;
  insert into public.promotion_assignment_records (employee_id, assignment_kind, region, started_on, ended_on, evidence, recorded_by_user_id)
  values (target_employee_id, clean_kind, clean_region, target_starts_on, target_ends_on, clean_evidence, caller_id) returning id into record_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_assignment_records', record_id::text, 'created', jsonb_build_object('employee_id', target_employee_id));
  return record_id;
end;
$$;

create or replace function public.record_promotion_award(target_employee_id uuid, target_award_key text, target_awarded_on date, target_present_rank_id bigint, target_evidence text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  record_id uuid;
  employee_row public.employees%rowtype;
  clean_key text := btrim(coalesce(target_award_key, ''));
  clean_evidence text := btrim(coalesce(target_evidence, ''));
begin
  if target_awarded_on is null or target_present_rank_id is null then raise exception 'Enter the award date and present rank.' using errcode = '22023'; end if;
  if clean_key not in ('medalya_ng_kagitingan', 'medalya_ng_kabayanihan', 'medalya_ng_katapangan', 'medalya_ng_kadakilaan', 'medalya_ng_kagalingan', 'medalya_ng_sugat_na_magiting', 'medalya_ng_papuri', 'medalya_ng_katapatan_sa_paglingkod', 'medalya_ng_katangi_tanging_gawa', 'medalya_ng_pambihirang_paglingkod', 'medalya_ng_kasanayan', 'medalya_ng_paglingkod', 'medalya_ng_mabuting_asal', 'medalya_ng_pagtulong_sa_nasalanta', 'tsapa_ng_natatanging_yunit', 'medalya_ng_ugnayang_pampublisya', 'medalya_ng_paglingkod_sa_luzon_visayas_mindanao', 'tsapa_ng_kwalipikasyon', 'commendation') then raise exception 'Choose an official promotion-policy award.' using errcode = '22023'; end if;
  if char_length(clean_evidence) not between 1 and 2000 then raise exception 'Enter supporting evidence up to 2000 characters.' using errcode = '22023'; end if;
  select * into employee_row from public.employees where id = target_employee_id for update;
  if employee_row.id is null then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  if employee_row.rank_id is distinct from target_present_rank_id then raise exception 'Awards must be recorded against the employee current rank.' using errcode = '22023'; end if;
  insert into public.promotion_award_records (employee_id, award_key, awarded_on, present_rank_id, evidence, recorded_by_user_id)
  values (target_employee_id, clean_key, target_awarded_on, target_present_rank_id, clean_evidence, caller_id) returning id into record_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_award_records', record_id::text, 'created', jsonb_build_object('employee_id', target_employee_id));
  return record_id;
end;
$$;

create or replace function public.record_promotion_board_assessment(target_employee_id uuid, target_criterion text, target_band text, target_assessed_on date, target_score numeric, target_evidence text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  record_id uuid;
  clean_criterion text := btrim(coalesce(target_criterion, ''));
  clean_band text := btrim(coalesce(target_band, ''));
  clean_evidence text := btrim(coalesce(target_evidence, ''));
  maximum numeric;
begin
  if target_assessed_on is null or target_score is null then raise exception 'Enter the assessment date and score.' using errcode = '22023'; end if;
  if clean_criterion not in ('board', 'reputation') or clean_band not in ('PCPL-PMSG', 'PSMS-PEMS', 'PLT-PLTCOL') then raise exception 'Choose an official scorecard criterion and band.' using errcode = '22023'; end if;
  maximum := case clean_criterion when 'board' then case when clean_band = 'PCPL-PMSG' then 15 else 10 end else case when clean_band = 'PCPL-PMSG' then 20 else 25 end end;
  if target_score < 0 or target_score > maximum then raise exception 'The score must be between 0 and %.', maximum using errcode = '22023'; end if;
  if char_length(clean_evidence) not between 1 and 2000 then raise exception 'Enter supporting evidence up to 2000 characters.' using errcode = '22023'; end if;
  perform 1 from public.employees where id = target_employee_id for update;
  if not found then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  insert into public.promotion_board_assessments (employee_id, criterion, band, assessed_on, score, evidence, recorded_by_user_id)
  values (target_employee_id, clean_criterion, clean_band, target_assessed_on, target_score, clean_evidence, caller_id) returning id into record_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_board_assessments', record_id::text, 'created', jsonb_build_object('employee_id', target_employee_id));
  return record_id;
end;
$$;

revoke all on function public.record_promotion_assignment(uuid, text, text, date, date, text), public.record_promotion_award(uuid, text, date, bigint, text), public.record_promotion_board_assessment(uuid, text, text, date, numeric, text) from public, anon;
grant execute on function public.record_promotion_assignment(uuid, text, text, date, date, text), public.record_promotion_award(uuid, text, date, bigint, text), public.record_promotion_board_assessment(uuid, text, text, date, numeric, text) to authenticated, service_role;

drop function public.list_promotion_candidates_page(text, text, integer, integer, uuid);
create function public.list_promotion_candidates_page(
  target_search text default null,
  target_status text default null,
  target_page integer default 1,
  target_page_size integer default 25,
  target_employee_id uuid default null
)
returns table (
  employee_id uuid, employee_name text, employee_number text, rank_id bigint, rank_code text, rank_name text,
  target_rank_id bigint, target_rank_code text, target_rank_name text, status text, decision_id uuid, remarks text,
  decided_at timestamptz, score numeric, maximum_score numeric, band text, eligibility_rating text, evaluation jsonb, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(target_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(target_page_size, 25), 1), 100);
  terms text[] := (select coalesce(array_agg(term), '{}') from (select term from regexp_split_to_table(lower(btrim(coalesce(target_search, ''))), '\s+') term where term <> '' limit 6) words);
begin
  perform private.require_active_hr();
  if target_status is not null and target_status not in ('for_approval', 'approved', 'rejected') then raise exception 'Unknown promotion status.' using errcode = '22023'; end if;
  return query
  with scored as (
    select employee.id, employee.employee_number, concat_ws(', ', employee.last_name, employee.first_name) as full_name,
      current_rank.id as current_rank_id, current_rank.code as current_rank_code, current_rank.name as current_rank_name,
      target_rank.id as next_rank_id, target_rank.code as next_rank_code, target_rank.name as next_rank_name,
      private.evaluate_promotion_scorecard(employee.id, current_date) as scorecard,
      lower(concat_ws(' ', public.search_text(employee), current_rank.code, current_rank.name, target_rank.code, target_rank.name)) as haystack
    from public.employees employee
    join public.ranks current_rank on current_rank.id = employee.rank_id and current_rank.code <> 'NUP'
    join public.ranks target_rank on target_rank.id = private.next_promotion_rank(current_rank.id)
    where employee.employment_status = 'active' and (target_employee_id is null or employee.id = target_employee_id)
  ), listed as (
    select scored.*, decision.id as row_decision_id, coalesce(decision.status, 'for_approval') as row_status, decision.remarks as decision_remarks, decision.decided_at as decision_decided_at
    from scored
    left join public.promotion_decisions decision on decision.employee_id = scored.id and decision.target_rank_id = scored.next_rank_id
    where scorecard ->> 'reason' is null and not exists (select 1 from unnest(terms) term where strpos(scored.haystack, term) = 0)
  )
  select listed.id, listed.full_name, listed.employee_number, listed.current_rank_id, listed.current_rank_code, listed.current_rank_name,
    listed.next_rank_id, listed.next_rank_code, listed.next_rank_name, listed.row_status, listed.row_decision_id, listed.decision_remarks,
    listed.decision_decided_at, (listed.scorecard ->> 'totalScore')::numeric, (listed.scorecard ->> 'maximumScore')::numeric,
    listed.scorecard ->> 'band', listed.scorecard -> 'eligibility' -> 'record' ->> 'rating', listed.scorecard, count(*) over()
  from listed
  where target_status is null or listed.row_status = target_status
  order by (listed.scorecard ->> 'totalScore')::numeric desc, listed.full_name, listed.id
  offset (safe_page - 1) * safe_page_size limit safe_page_size;
end;
$$;
revoke all on function public.list_promotion_candidates_page(text, text, integer, integer, uuid) from public, anon;
grant execute on function public.list_promotion_candidates_page(text, text, integer, integer, uuid) to authenticated, service_role;

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
  evaluation := private.evaluate_promotion_scorecard(target_employee_id, current_date);
  if evaluation is null then return null; end if;
  return jsonb_build_object('evaluation', evaluation, 'decision', case when jsonb_typeof(evaluation -> 'targetRank') = 'object' then private.promotion_decision_json(target_employee_id, (evaluation -> 'targetRank' ->> 'id')::bigint) end);
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
  evaluation jsonb := private.evaluate_promotion_scorecard(own_employee_id, current_date);
begin
  return jsonb_build_object(
    'evaluation', evaluation,
    'decision', case when jsonb_typeof(evaluation -> 'targetRank') = 'object' then private.promotion_decision_json(own_employee_id, (evaluation -> 'targetRank' ->> 'id')::bigint) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', decision.id, 'status', decision.status, 'remarks', decision.remarks, 'decidedAt', decision.decided_at, 'targetRankCode', rank.code, 'targetRankName', rank.name) order by decision.decided_at desc) from public.promotion_decisions decision join public.ranks rank on rank.id = decision.target_rank_id where decision.employee_id = own_employee_id), '[]'::jsonb)
  );
end;
$$;

-- HR decisions snapshot the PDF scorecard. The PDF defines no pass mark, so a decision is gated only on
-- the Promotion Board assessments the policy requires; approval never changes employees.rank_id.
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
  evaluation := private.evaluate_promotion_scorecard(target_employee_id, current_date);
  if evaluation ->> 'reason' is not null or jsonb_typeof(evaluation -> 'targetRank') is distinct from 'object' then
    raise exception 'This employee is not evaluated on a PDF promotion scorecard.' using errcode = 'P0001';
  end if;
  target_rank_value := (evaluation -> 'targetRank' ->> 'id')::bigint;
  if exists (select 1 from public.promotion_decisions where employee_id = target_employee_id and target_rank_id = target_rank_value) then
    raise exception 'A decision for this promotion was already recorded.' using errcode = '23505';
  end if;
  if exists (select 1 from jsonb_array_elements(evaluation -> 'criteria') criterion where criterion ->> 'state' = 'unassessed') then
    raise exception 'Record the Promotion Board assessments before deciding this promotion.' using errcode = 'P0001';
  end if;

  insert into public.promotion_decisions (employee_id, from_rank_id, target_rank_id, status, remarks, evaluation_snapshot, decided_by_user_id)
  values (target_employee_id, employee_row.rank_id, target_rank_value, decision_status, clean_remarks, evaluation, caller_id)
  returning id into decision_id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'promotion_decisions', decision_id::text, decision_status, jsonb_build_object('employee_id', target_employee_id, 'from_rank_id', employee_row.rank_id, 'target_rank_id', target_rank_value, 'score', evaluation -> 'totalScore'));

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

-- The Promotion Evaluation report lists the same scorecards as the HR dashboard; every other report
-- key keeps the operational implementation.
alter function private.get_hr_report(text, date, date, bigint, text, integer, integer) rename to get_hr_report_operational;

create or replace function private.get_hr_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; page_offset integer := (target_page - 1) * target_page_size;
begin
  if target_report_key is distinct from 'promotion-evaluation' then
    return private.get_hr_report_operational(target_report_key, target_starts_on, target_ends_on, target_department_id, target_status, target_page, target_page_size);
  end if;
  perform private.require_active_reporting_role(array['hr_personnel'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on, target_page, target_page_size);
  with scored as (
    select e.id, concat_ws(' ', e.first_name, e.last_name) employee, private.evaluate_promotion_scorecard(e.id, current_date) scorecard
    from public.employees e
    where e.employment_status = 'active' and (target_department_id is null or e.department_id = target_department_id)
  ), filtered as (
    select scored.*, coalesce(d.status, 'for_approval') status
    from scored
    left join public.promotion_decisions d on d.employee_id = scored.id and d.target_rank_id = (scored.scorecard -> 'targetRank' ->> 'id')::bigint
    where scored.scorecard ->> 'reason' is null and (target_status is null or coalesce(d.status, 'for_approval') = target_status)
  ), paged as (
    select * from filtered order by (scorecard ->> 'totalScore')::numeric desc, employee, id limit target_page_size offset page_offset
  )
  select jsonb_build_object('reportKey', target_report_key, 'title', 'Promotion Evaluation', 'generatedAt', now(),
    'columns', jsonb_build_array(jsonb_build_object('key', 'rank', 'label', 'Rank'), jsonb_build_object('key', 'employee', 'label', 'Name'), jsonb_build_object('key', 'targetRank', 'label', 'Target Rank'), jsonb_build_object('key', 'score', 'label', 'Score'), jsonb_build_object('key', 'eligibility', 'label', 'Eligibility'), jsonb_build_object('key', 'status', 'label', 'Status')),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('rank', scorecard -> 'currentRank' ->> 'code', 'employee', employee, 'targetRank', scorecard -> 'targetRank' ->> 'code', 'score', trim_scale((scorecard ->> 'totalScore')::numeric)::text || ' / ' || (scorecard ->> 'maximumScore'), 'eligibility', coalesce(scorecard -> 'eligibility' -> 'record' ->> 'name', 'None on record'), 'status', status) order by (scorecard ->> 'totalScore')::numeric desc, employee, id) from paged), '[]'::jsonb),
    'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  return result;
end $$;

revoke all on function private.get_hr_report_operational(text, date, date, bigint, text, integer, integer), private.get_hr_report(text, date, date, bigint, text, integer, integer) from public, anon, authenticated;
