begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(12);

select extensions.has_table('public', 'physical_fitness_results', 'Physical fitness results are stored as official personnel evidence');
select extensions.has_function('public', 'create_promotion_criterion', array['integer', 'integer', 'integer', 'jsonb', 'integer', 'integer', 'numeric', 'integer'], 'Promotion criteria accept all evaluation groups');
select extensions.has_function('public', 'record_physical_fitness_result', array['uuid', 'numeric', 'date', 'date', 'text'], 'HR PFT recording RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000001721', 'authenticated', 'authenticated', 'criteria-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001722', 'authenticated', 'authenticated', 'criteria-employee@example.test', now(), now());

update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000001721'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end where user_id in ('00000000-0000-4000-8000-000000001721'::uuid, '00000000-0000-4000-8000-000000001722'::uuid);

insert into public.ranks (id, name, code, sort_order, is_active) overriding system value
values (9920, 'Evaluation Base Rank', 'EBR', 9920, true), (9921, 'Evaluation Target Rank', 'ETR', 9921, true);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, rank_id, employment_started_on)
values ('00000000-0000-4000-8000-000000001731', '00000000-0000-4000-8000-000000001722', 'EVAL-001', 'Evaluation', 'Officer', 'criteria-employee@example.test', 9920, (current_date - interval '8 years')::date);

insert into public.service_history (employee_id, rank_id, started_on)
values ('00000000-0000-4000-8000-000000001731', 9920, (current_date - interval '3 years')::date);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001721';

select set_config('test.criterion_id', public.create_promotion_criterion(9921, 1, 4, '[]'::jsonb, 2, 12, 75, 6)::text, true);
select extensions.lives_ok($$select public.create_performance_rating('00000000-0000-4000-8000-000000001731'::uuid, 4, (current_date - interval '3 months')::date, (current_date - interval '1 month')::date, 'Recent IPER')$$, 'HR records an IPER result');
select extensions.lives_ok($$select public.record_physical_fitness_result('00000000-0000-4000-8000-000000001731'::uuid, 80::numeric, (current_date - interval '7 months')::date, (current_date + interval '6 months')::date, 'Old but not expired')$$, 'HR records physical fitness evidence');

set local role postgres;
select extensions.ok(
  not ((private.promotion_readiness('00000000-0000-4000-8000-000000001731', current_setting('test.criterion_id')::uuid, current_date) ->> 'isReady')::boolean),
  'A PFT outside the configured evidence-validity window does not make the employee ready'
);
select extensions.ok(
  exists (select 1 from jsonb_array_elements_text(private.promotion_readiness('00000000-0000-4000-8000-000000001731', current_setting('test.criterion_id')::uuid, current_date) -> 'missingRequirements') requirement where requirement like 'PFT score 75% (valid 6 months)'),
  'Readiness identifies the missing PFT evidence'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001721';
select public.record_physical_fitness_result('00000000-0000-4000-8000-000000001731'::uuid, 80::numeric, (current_date - interval '3 months')::date, (current_date + interval '3 months')::date, 'Current test');

set local role postgres;
select extensions.ok(
  (private.promotion_readiness('00000000-0000-4000-8000-000000001731', current_setting('test.criterion_id')::uuid, current_date) ->> 'isReady')::boolean,
  'Time in grade, IPER, and current PFT evidence make the employee ready'
);
select extensions.is(
  jsonb_array_length(private.promotion_readiness('00000000-0000-4000-8000-000000001731', current_setting('test.criterion_id')::uuid, current_date) -> 'requirements'),
  3,
  'Readiness reports every configured evaluation group'
);
select extensions.is((select rank_id from public.employees where id = '00000000-0000-4000-8000-000000001731'::uuid), 9920::bigint, 'Readiness never promotes an employee automatically');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001722';
select extensions.is((select count(*) from public.physical_fitness_results), 2::bigint, 'An employee may read their own PFT evidence');
select extensions.throws_ok(
  $$select public.record_physical_fitness_result('00000000-0000-4000-8000-000000001731'::uuid, 90::numeric, current_date, (current_date + interval '1 year')::date, null)$$,
  '42501', null, 'An employee cannot record their own PFT evidence'
);

select * from extensions.finish();

rollback;
