create schema if not exists pgmq_public;

create or replace function pgmq_public.read(
  queue_name text,
  sleep_seconds integer default 0,
  n integer default 1
)
returns setof pgmq.message_record
language sql
security definer
set search_path = ''
as $$
  select *
  from pgmq.read(queue_name, sleep_seconds, n, '{}'::jsonb);
$$;

create or replace function pgmq_public.send(
  queue_name text,
  message jsonb,
  sleep_seconds integer default 0
)
returns setof bigint
language sql
security definer
set search_path = ''
as $$
  select *
  from pgmq.send(queue_name, message, sleep_seconds);
$$;

create or replace function pgmq_public.delete(
  queue_name text,
  msg_id bigint
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select pgmq.delete(queue_name, msg_id);
$$;

revoke all on schema pgmq_public from public, anon, authenticated;
grant usage on schema pgmq_public to service_role;

revoke all on function pgmq_public.read(text, integer, integer) from public, anon, authenticated;
revoke all on function pgmq_public.send(text, jsonb, integer) from public, anon, authenticated;
revoke all on function pgmq_public.delete(text, bigint) from public, anon, authenticated;
grant execute on function pgmq_public.read(text, integer, integer) to service_role;
grant execute on function pgmq_public.send(text, jsonb, integer) to service_role;
grant execute on function pgmq_public.delete(text, bigint) to service_role;
