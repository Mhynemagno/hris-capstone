create or replace function private.retry_application_analysis(target_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  latest_attempt public.application_ai_scores;
  retry_score_id uuid;
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then
    raise exception 'Human Resources access is required.' using errcode = '42501';
  end if;

  select * into latest_attempt
  from public.application_ai_scores
  where application_id = target_application_id
  order by created_at desc, id desc
  limit 1;

  if latest_attempt.id is null or latest_attempt.status <> 'failed' then
    raise exception 'Analysis can be retried only after it has failed.' using errcode = 'P0001';
  end if;

  insert into public.application_ai_scores (application_id, requested_by_user_id, status, created_at)
  values (target_application_id, caller_id, 'queued', clock_timestamp())
  returning id into retry_score_id;

  perform pgmq.send('application_analysis', jsonb_build_object('scoreId', retry_score_id));

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (
    caller_id,
    'applications',
    target_application_id::text,
    'ai_retry_queued',
    jsonb_build_object('score_id', retry_score_id, 'previous_score_id', latest_attempt.id)
  );

  return retry_score_id;
end;
$$;

create or replace function public.retry_application_analysis(target_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.retry_application_analysis(target_application_id);
end;
$$;

revoke all on function private.retry_application_analysis(uuid) from public, anon, authenticated;
revoke all on function public.retry_application_analysis(uuid) from public, anon;
grant execute on function public.retry_application_analysis(uuid) to authenticated;
