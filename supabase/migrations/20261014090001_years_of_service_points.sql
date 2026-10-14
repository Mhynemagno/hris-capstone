-- Client feedback (2026-10-14): higher years-of-service points.
--   <1 = 10, 1-3 = 25, 4-6 = 35, 7-9 = 45, 10-14 = 50, 15+ = 60 (was 5/15/25/35/45/50).
-- Saved evaluations keep the points they were scored with.

alter table public.performance_ratings
  drop constraint performance_ratings_service_points_check,
  add constraint performance_ratings_service_points_check check (service_points is null or service_points between 0 and 60);

create or replace function private.performance_rubric(target_employee_id uuid, target_as_of date)
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
  service := case when years >= 15 then 60 when years >= 10 then 50 when years >= 7 then 45 when years >= 4 then 35 when years >= 1 then 25 else 10 end;
  select
    count(distinct private.certification_course_key(name)) filter (where category = 'mandatory_course'),
    count(distinct private.certification_course_key(name)) filter (where category = 'specialized_training')
  into mandatory_count, specialized_count
  from public.certifications
  where employee_id = target_employee_id and issued_on <= target_as_of and (expires_on is null or expires_on >= target_as_of);
  mandatory := least(mandatory_count * 15, 30);
  specialized := least(specialized_count * 10, 20);
  -- Service (60) + courses (50) can exceed the 100-point grading scale, so the total is capped at 100.
  total := least(service + mandatory + specialized, 100);
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
