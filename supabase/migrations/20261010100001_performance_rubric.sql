-- Client round 5 (2026-10-10): performance is graded with a points rubric instead of a 1-5 dropdown.
--   * Service years: <1 = 5, 1-3 = 15, 4-6 = 25, 7-9 = 35, 10-14 = 45, 15+ = 50 (out of 50).
--   * Mandatory Career Course: 15 points each, capped at 30. Specialized Unit Training: 10 each, capped at 20.
--   * Total -> grade: 90-100 1.00 Outstanding, 80-89 1.50 Very Satisfactory, 70-79 2.00 Satisfactory,
--     60-69 2.50 Unsatisfactory, below 60 3.00 Poor.
-- Certification / Training records carry the course category, set from the course name by a trigger.
-- performance_ratings keeps its 1-5 rating (derived from the descriptive rating) so promotion criteria still work.

alter table public.certifications
  add column category text check (category is null or category in ('mandatory_course', 'specialized_training'));

create function private.certification_category(target_name text)
returns text language sql immutable set search_path = '' as $$
  select case
    when lower(btrim(target_name)) in (
      'public safety basic recruit course (psbrc)',
      'public safety junior leadership course (psjlc)',
      'public safety senior leadership course (psslc)',
      'public safety officers candidate course (psocc)',
      'public safety officers basic course (psobc)',
      'public safety officers advance course (psoac)'
    ) then 'mandatory_course'
    when lower(btrim(target_name)) in (
      'criminal investigation course (cic) / soco',
      'special weapons and tactics (swat) course',
      'special action force (saf) commando course',
      'traffic management / tactical driving course',
      'cybercrime investigation seminar',
      -- Courses from the previous Certification / Training list keep their points as specialized training.
      'criminal investigation course',
      'police intelligence operations course',
      'drug enforcement operations course',
      'leadership and management course',
      'senior police leadership and command course'
    ) then 'specialized_training'
  end;
$$;

-- One course under its old and new names counts once (the previous "Criminal Investigation Course").
create function private.certification_course_key(target_name text)
returns text language sql immutable set search_path = '' as $$
  select case lower(btrim(target_name))
    when 'criminal investigation course' then 'criminal investigation course (cic) / soco'
    else lower(btrim(target_name))
  end;
$$;

create function private.set_certification_category()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.category := private.certification_category(new.name);
  return new;
end;
$$;

-- Runs on every insert and update so the category always follows the name and cannot be set by hand.
create trigger certifications_set_category
  before insert or update on public.certifications
  for each row execute function private.set_certification_category();

-- Backfill only rows that gain a category, without writing personnel record history for it.
alter table public.certifications disable trigger certifications_write_record_history;
update public.certifications set category = private.certification_category(name) where private.certification_category(name) is not null;
alter table public.certifications enable trigger certifications_write_record_history;

alter table public.performance_ratings
  add column years_of_service integer check (years_of_service is null or years_of_service >= 0),
  add column service_points integer check (service_points is null or service_points between 0 and 50),
  add column mandatory_points integer check (mandatory_points is null or mandatory_points between 0 and 30),
  add column specialized_points integer check (specialized_points is null or specialized_points between 0 and 20),
  add column total_points integer check (total_points is null or total_points between 0 and 100),
  add column grade_equivalent text check (grade_equivalent is null or grade_equivalent in ('1.00', '1.50', '2.00', '2.50', '3.00')),
  add column descriptive_rating text check (descriptive_rating is null or descriptive_rating in ('Outstanding', 'Very Satisfactory', 'Satisfactory', 'Unsatisfactory', 'Poor'));

create function private.performance_rubric(target_employee_id uuid, target_as_of date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  started_on date;
  years integer;
  service integer;
  mandatory_count integer;
  specialized_count integer;
  mandatory integer;
  specialized integer;
  total integer;
begin
  select employment_started_on into started_on from public.employees where id = target_employee_id;
  if started_on is null then
    raise exception 'Employee was not found.' using errcode = 'P0001';
  end if;
  -- A review period that ends in the future is scored as of today.
  target_as_of := least(target_as_of, current_date);
  years := greatest(extract(year from age(target_as_of, started_on))::integer, 0);
  service := case when years >= 15 then 50 when years >= 10 then 45 when years >= 7 then 35 when years >= 4 then 25 when years >= 1 then 15 else 5 end;
  select
    count(distinct private.certification_course_key(name)) filter (where category = 'mandatory_course'),
    count(distinct private.certification_course_key(name)) filter (where category = 'specialized_training')
  into mandatory_count, specialized_count
  from public.certifications
  where employee_id = target_employee_id and issued_on <= target_as_of and (expires_on is null or expires_on >= target_as_of);
  mandatory := least(mandatory_count * 15, 30);
  specialized := least(specialized_count * 10, 20);
  total := service + mandatory + specialized;
  return jsonb_build_object(
    'yearsOfService', years,
    'servicePoints', service,
    'mandatoryCount', mandatory_count,
    'mandatoryPoints', mandatory,
    'specializedCount', specialized_count,
    'specializedPoints', specialized,
    'totalPoints', total,
    'grade', case when total >= 90 then '1.00' when total >= 80 then '1.50' when total >= 70 then '2.00' when total >= 60 then '2.50' else '3.00' end,
    'rating', case when total >= 90 then 'Outstanding' when total >= 80 then 'Very Satisfactory' when total >= 70 then 'Satisfactory' when total >= 60 then 'Unsatisfactory' else 'Poor' end,
    'ratingValue', case when total >= 90 then 5 when total >= 80 then 4 when total >= 70 then 3 when total >= 60 then 2 else 1 end
  );
end;
$$;

create function public.get_performance_rubric(target_employee_id uuid, target_as_of date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active_hr();
  return private.performance_rubric(target_employee_id, coalesce(target_as_of, current_date));
end;
$$;

create function public.record_performance_evaluation(target_employee_id uuid, target_starts_on date, target_ends_on date, target_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  clean_notes text := nullif(btrim(target_notes), '');
  rubric jsonb;
  new_rating_id uuid;
begin
  if target_starts_on is null or target_ends_on is null or target_ends_on < target_starts_on then
    raise exception 'The review period must end on or after it starts.' using errcode = '22023';
  end if;
  if clean_notes is not null and char_length(clean_notes) > 2000 then
    raise exception 'HR notes must be at most 2000 characters.' using errcode = '22023';
  end if;
  rubric := private.performance_rubric(target_employee_id, target_ends_on);

  insert into public.performance_ratings (
    employee_id, rating, review_period_starts_on, review_period_ends_on, notes, created_by_user_id, updated_by_user_id,
    years_of_service, service_points, mandatory_points, specialized_points, total_points, grade_equivalent, descriptive_rating
  ) values (
    target_employee_id, (rubric ->> 'ratingValue')::integer, target_starts_on, target_ends_on, clean_notes, caller_id, caller_id,
    (rubric ->> 'yearsOfService')::integer, (rubric ->> 'servicePoints')::integer, (rubric ->> 'mandatoryPoints')::integer,
    (rubric ->> 'specializedPoints')::integer, (rubric ->> 'totalPoints')::integer, rubric ->> 'grade', rubric ->> 'rating'
  ) returning id into new_rating_id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'performance_ratings', new_rating_id::text, 'created', jsonb_build_object('employee_id', target_employee_id, 'total_points', rubric -> 'totalPoints'));
  return new_rating_id;
end;
$$;

revoke all on function private.certification_category(text), private.certification_course_key(text), private.set_certification_category(), private.performance_rubric(uuid, date) from public, anon, authenticated;
revoke all on function public.get_performance_rubric(uuid, date), public.record_performance_evaluation(uuid, date, date, text) from public, anon;
grant execute on function public.get_performance_rubric(uuid, date), public.record_performance_evaluation(uuid, date, date, text) to authenticated;
