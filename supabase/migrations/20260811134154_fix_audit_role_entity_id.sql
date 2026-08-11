create or replace function private.audit_privileged_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_row jsonb;
  changed_id text;
begin
  changed_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  changed_id := coalesce(changed_row ->> 'id', changed_row ->> 'user_id');

  insert into public.audit_logs (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    (select auth.uid()),
    tg_table_name,
    changed_id,
    lower(tg_op),
    changed_row - 'assigned_by'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
