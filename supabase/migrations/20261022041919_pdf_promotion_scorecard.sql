-- Complete system-owned promotion scorecard transcribed from Final Revisions.pdf pp. 18-20.
-- This helper is deliberately private: public read RPCs authorize HR before exposing results.

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
  band text;
  seniority_points numeric := 0;
  allocation jsonb;
  criteria jsonb;
  eligibility_record jsonb;
begin
  select * into employee_row from public.employees where id = target_employee_id;
  if employee_row.id is null then return null; end if;
  select * into current_rank from public.ranks where id = employee_row.rank_id;
  if employee_row.employment_status <> 'active' then
    return jsonb_build_object('employeeId', employee_row.id, 'evaluatedOn', on_date, 'currentRank', null, 'targetRank', null, 'reason', 'inactive');
  end if;
  if current_rank.id is null then
    return jsonb_build_object('employeeId', employee_row.id, 'evaluatedOn', on_date, 'currentRank', null, 'targetRank', null, 'reason', 'no_rank');
  end if;
  if current_rank.code = 'NUP' then
    return jsonb_build_object('employeeId', employee_row.id, 'evaluatedOn', on_date, 'currentRank', jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name), 'targetRank', null, 'reason', 'non_uniformed');
  end if;
  band := private.promotion_scorecard_band(current_rank.code);
  if band is null then
    return jsonb_build_object('employeeId', employee_row.id, 'evaluatedOn', on_date, 'currentRank', jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name), 'targetRank', null, 'reason', 'below_scored_rank');
  end if;
  select * into target_rank from public.ranks where id = private.next_promotion_rank(current_rank.id);
  if target_rank.id is null then
    return jsonb_build_object('employeeId', employee_row.id, 'evaluatedOn', on_date, 'currentRank', jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name), 'targetRank', null, 'reason', 'top_rank');
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
  where row.score_band = band and on_date >= rank_since + make_interval(years => row.years, months => row.months, days => row.days);

  allocation := case band
    when 'PCPL-PMSG' then jsonb_build_object('seniority', 30, 'assignment', 20, 'awards', 10, 'iper', 5, 'board', 15, 'reputation', 20)
    else jsonb_build_object('seniority', 25, 'assignment', 25, 'awards', 10, 'iper', 5, 'board', 10, 'reputation', 25)
  end;
  criteria := jsonb_build_array(
    jsonb_build_object('key', 'seniority', 'label', 'Seniority / time in grade', 'points', seniority_points, 'maximumPoints', allocation -> 'seniority', 'state', 'calculated', 'evidence', jsonb_build_object('rankSince', rank_since)),
    jsonb_build_object('key', 'assignment', 'label', 'Diversity of assignment', 'points', 0, 'maximumPoints', allocation -> 'assignment', 'state', 'missing', 'evidence', '[]'::jsonb),
    jsonb_build_object('key', 'awards', 'label', 'Awards and recognition', 'points', 0, 'maximumPoints', allocation -> 'awards', 'state', 'missing', 'evidence', '[]'::jsonb),
    jsonb_build_object('key', 'iper', 'label', 'IPER', 'points', 0, 'maximumPoints', allocation -> 'iper', 'state', 'missing', 'evidence', '[]'::jsonb),
    jsonb_build_object('key', 'board', 'label', case when band = 'PCPL-PMSG' then 'Interview' else 'Competence to assume position / leadership experience' end, 'points', 0, 'maximumPoints', allocation -> 'board', 'state', 'unassessed', 'evidence', '[]'::jsonb),
    jsonb_build_object('key', 'reputation', 'label', 'Service reputation', 'points', 0, 'maximumPoints', allocation -> 'reputation', 'state', 'unassessed', 'evidence', '[]'::jsonb)
  );
  select jsonb_build_object('id', qualification.id, 'name', qualification.name, 'rating', to_jsonb(qualification) ->> 'rating', 'awardedOn', qualification.awarded_on)
  into eligibility_record
  from public.qualifications qualification
  where qualification.employee_id = employee_row.id
  order by qualification.awarded_on desc, qualification.created_at desc
  limit 1;

  return jsonb_build_object(
    'employeeId', employee_row.id, 'evaluatedOn', on_date,
    'band', band, 'totalScore', seniority_points, 'maximumScore', 100,
    'criteria', criteria,
    'eligibility', jsonb_build_object('record', eligibility_record),
    'currentRank', jsonb_build_object('id', current_rank.id, 'code', current_rank.code, 'name', current_rank.name),
    'targetRank', jsonb_build_object('id', target_rank.id, 'code', target_rank.code, 'name', target_rank.name),
    'reason', null
  );
end;
$$;

revoke all on function private.promotion_scorecard_band(text), private.evaluate_promotion_scorecard(uuid, date) from public, anon, authenticated;
