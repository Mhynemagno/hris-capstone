create table public.application_ai_scores (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  requested_by_user_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  score smallint check (score between 0 and 100),
  explanation text check (explanation is null or char_length(btrim(explanation)) between 1 and 4000),
  provider text check (provider is null or char_length(btrim(provider)) between 1 and 80),
  model text check (model is null or char_length(btrim(model)) between 1 and 160),
  model_version text check (model_version is null or char_length(btrim(model_version)) between 1 and 160),
  failure_code text check (failure_code is null or failure_code in ('configuration_unavailable', 'provider_unavailable', 'provider_invalid_response', 'persistence_failed')),
  input_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending'
      and score is null
      and explanation is null
      and provider is null
      and model is null
      and model_version is null
      and failure_code is null
      and completed_at is null)
    or (status = 'completed'
      and score is not null
      and explanation is not null
      and provider is not null
      and model is not null
      and model_version is not null
      and failure_code is null
      and completed_at is not null)
    or (status = 'failed'
      and score is null
      and explanation is null
      and provider is null
      and model is null
      and model_version is null
      and failure_code is not null
      and completed_at is not null)
  )
);

create index application_ai_scores_application_created_idx
  on public.application_ai_scores (application_id, created_at desc);
create index application_ai_scores_completed_score_idx
  on public.application_ai_scores (score desc, completed_at desc)
  where status = 'completed';

alter table public.application_ai_scores enable row level security;

revoke all on table public.application_ai_scores from anon, authenticated;
grant select on table public.application_ai_scores to authenticated;

create policy application_ai_scores_select_hr
  on public.application_ai_scores for select to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));

create or replace function public.list_hr_application_shortlist(
  target_application_status text default null,
  target_ai_status text default null,
  minimum_score smallint default null
)
returns table (
  application_id uuid,
  applicant_id uuid,
  job_opening_id bigint,
  application_status text,
  submitted_at timestamptz,
  ai_score_id uuid,
  ai_score_status text,
  ai_score smallint,
  ai_explanation text,
  ai_provider text,
  ai_model text,
  ai_model_version text,
  ai_completed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    application.id,
    application.applicant_id,
    application.job_opening_id,
    application.status,
    application.submitted_at,
    latest.id,
    latest.status,
    latest.score,
    latest.explanation,
    latest.provider,
    latest.model,
    latest.model_version,
    latest.completed_at
  from public.applications application
  left join lateral (
    select score.*
    from public.application_ai_scores score
    where score.application_id = application.id
    order by score.created_at desc
    limit 1
  ) latest on true
  where (target_application_status is null or application.status = target_application_status)
    and (target_ai_status is null or coalesce(latest.status, 'unscored') = target_ai_status)
    and (minimum_score is null or latest.score >= minimum_score)
  order by
    case latest.status when 'completed' then 0 when 'failed' then 1 else 2 end,
    latest.score desc nulls last,
    application.created_at asc;
$$;

revoke all on function public.list_hr_application_shortlist(text, text, smallint)
  from public, anon;
grant execute on function public.list_hr_application_shortlist(text, text, smallint)
  to authenticated;
