begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(3);

select extensions.has_index('public', 'employees', 'employees_personal_email_unique_idx', 'Employee personal emails have a unique index');

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values ('00000000-0000-4000-8000-000000002101', 'UNQ-001', 'Unique', 'One', 'same.person@example.test', '2024-01-01');

select extensions.throws_ok(
  $$insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
    values ('00000000-0000-4000-8000-000000002102', 'UNQ-002', 'Unique', 'Two', 'same.person@example.test', '2024-01-01')$$,
  '23505', null, 'A second employee cannot reuse an email (stored lower-case by employees_personal_email_check)'
);
select extensions.lives_ok(
  $$insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
    values ('00000000-0000-4000-8000-000000002103', 'UNQ-003', 'Unique', 'Three', 'other.person@example.test', '2024-01-01')$$,
  'A different email is accepted'
);

select * from extensions.finish();

rollback;
