-- Keep older report clients working after date range filters were added.
-- The default range matches the frontend's rolling 30-day report range.
create or replace function public.get_hr_report(
  target_report_key text,
  target_starts_on date default (current_date - 29),
  target_ends_on date default current_date,
  target_department_id bigint default null,
  target_status text default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return private.get_hr_report(
    target_report_key,
    target_starts_on,
    target_ends_on,
    target_department_id,
    target_status,
    target_page,
    target_page_size
  );
end;
$$;

create or replace function public.get_management_report(
  target_report_key text,
  target_starts_on date default (current_date - 29),
  target_ends_on date default current_date,
  target_department_id bigint default null,
  target_status text default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return private.get_management_report(
    target_report_key,
    target_starts_on,
    target_ends_on,
    target_department_id,
    target_status,
    target_page,
    target_page_size
  );
end;
$$;

notify pgrst, 'reload schema';
