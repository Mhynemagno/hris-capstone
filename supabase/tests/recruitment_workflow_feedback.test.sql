begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(7);

select extensions.has_function('public', 'resubmit_application', array['uuid', 'jsonb'], 'Needs Revision resubmission RPC exists');
select extensions.has_function('public', 'delete_draft_job_opening', array['bigint'], 'Draft-only job delete RPC exists');
select extensions.has_function('public', 'withdraw_job_opening', array['bigint'], 'Job withdrawal RPC exists');
select extensions.has_function('public', 'hire_application', array['uuid', 'text', 'text'], 'Badge-number hiring RPC exists');
select extensions.hasnt_function('public', 'hire_application', array['uuid', 'text', 'bigint', 'bigint', 'date', 'text'], 'Legacy hiring RPC cannot bypass the default patrol position');
select extensions.ok(
  exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid = constraint_row.conrelid
    join pg_namespace schema on schema.oid = relation.relnamespace
    where schema.nspname = 'public'
      and relation.relname = 'applications'
      and pg_get_constraintdef(constraint_row.oid) like '%Needs Revision%'
  ),
  'Applications permit the Needs Revision status'
);
select extensions.ok(
  exists (select 1 from pg_trigger where tgname = 'job_openings_protect_applied_lifecycle' and not tgisinternal),
  'Applied job openings cannot be republished or returned to draft'
);

select * from extensions.finish();

rollback;
