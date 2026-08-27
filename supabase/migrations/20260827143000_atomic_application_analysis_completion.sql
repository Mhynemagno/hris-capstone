create or replace function public.complete_application_analysis(
  target_score_id uuid,
  target_score integer,
  target_explanation text,
  target_provider text,
  target_model text,
  target_model_version text,
  target_completed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_attempt public.application_ai_scores%rowtype;
begin
  update public.application_ai_scores
  set
    status = 'completed',
    score = target_score,
    explanation = target_explanation,
    provider = target_provider,
    model = target_model,
    model_version = target_model_version,
    completed_at = target_completed_at
  where id = target_score_id and status = 'processing'
  returning * into completed_attempt;

  if not found then return false; end if;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (
    null,
    'applications',
    completed_attempt.application_id::text,
    'ai_scored',
    jsonb_build_object(
      'score_id', completed_attempt.id,
      'status', 'completed',
      'provider', target_provider,
      'model', target_model
    )
  );

  return true;
end;
$$;

revoke all on function public.complete_application_analysis(uuid, integer, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_application_analysis(uuid, integer, text, text, text, text, timestamptz) to service_role;
