begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(27);

select extensions.has_table('public', 'promotion_rank_requirements', 'System-owned rank requirements exist');
select extensions.has_table('public', 'promotion_decisions', 'HR promotion decisions exist');
select extensions.has_function('public', 'list_promotion_candidates_page', array['text', 'text', 'integer', 'integer', 'uuid'], 'Dashboard RPC exists');
select extensions.has_function('public', 'decide_promotion', array['uuid', 'boolean', 'text'], 'Decision RPC exists');
select extensions.is(
  (select required_training from public.promotion_rank_requirements requirement join public.ranks rank on rank.id = requirement.target_rank_id where rank.code = 'PCPL'),
  array['Public Safety Junior Leadership Course (PSJLC)'],
  'PCPL requires PSJLC'
);
select extensions.is(private.rank_required_training('PAT'), array['Public Safety Basic Recruit Course (PSBRC)'], 'PAT current-rank training is PSBRC');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000012201', 'authenticated', 'authenticated', 'promo-auto-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000012202', 'authenticated', 'authenticated', 'promo-auto-ready@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000012203', 'authenticated', 'authenticated', 'promo-auto-missing@example.test', now(), now());

update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000012201'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end where user_id in ('00000000-0000-4000-8000-000000012201'::uuid, '00000000-0000-4000-8000-000000012202'::uuid, '00000000-0000-4000-8000-000000012203'::uuid);

-- Tolerate a NUP rank that may or may not exist yet (personnel workstream).
insert into public.ranks (name, code, sort_order, is_active)
select 'Non-Uniformed Personnel (test)', 'NUP', 9990, true
where not exists (select 1 from public.ranks where code = 'NUP');

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, rank_id, employment_started_on)
values
  ('00000000-0000-4000-8000-000000012211', '00000000-0000-4000-8000-000000012202', 'AUTO-READY', 'Ready', 'Corporal', 'promo-auto-ready@example.test', (select id from public.ranks where code = 'PCPL'), (current_date - interval '4 years')::date),
  ('00000000-0000-4000-8000-000000012212', '00000000-0000-4000-8000-000000012203', 'AUTO-MISS', 'Missing', 'Training', 'promo-auto-missing@example.test', (select id from public.ranks where code = 'PAT'), (current_date - interval '4 years')::date),
  ('00000000-0000-4000-8000-000000012213', null, '12345678', 'Civilian', 'Staff', 'promo-auto-nup@example.test', (select id from public.ranks where code = 'NUP'), (current_date - interval '10 years')::date);

-- Every requirement except training is on record for both PAT employees; only one has PSJLC.
insert into public.certifications (employee_id, name, issuer, issued_on)
values ('00000000-0000-4000-8000-000000012211', 'Public Safety Junior Leadership Course (PSJLC)', 'Philippine Public Safety College (PPSC)', current_date - 100);
insert into public.qualifications (employee_id, name, institution, awarded_on)
select employee_id, 'NAPOLCOM PNP Entrance Examination', 'National Police Commission (NAPOLCOM)', current_date - 2000
from (values ('00000000-0000-4000-8000-000000012211'::uuid), ('00000000-0000-4000-8000-000000012212'::uuid), ('00000000-0000-4000-8000-000000012213'::uuid)) people(employee_id);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000012201';

select extensions.lives_ok($$select public.record_iper_rating('00000000-0000-4000-8000-000000012211', (current_date - interval '6 months')::date, current_date - 1, 'Very Satisfactory', null)$$, 'HR records an adjectival IPER');
select public.record_iper_rating('00000000-0000-4000-8000-000000012212', (current_date - interval '6 months')::date, current_date - 1, 'Outstanding', null);
select public.record_iper_rating('00000000-0000-4000-8000-000000012213', (current_date - interval '6 months')::date, current_date - 1, 'Outstanding', null);
select extensions.lives_ok($$select public.record_pft_result('00000000-0000-4000-8000-000000012211', current_date - 30, true, null)$$, 'HR records a passed PFT');
select public.record_pft_result('00000000-0000-4000-8000-000000012212', current_date - 30, true, null);
select public.record_pft_result('00000000-0000-4000-8000-000000012213', current_date - 30, true, null);
select extensions.throws_ok($$select public.record_iper_rating('00000000-0000-4000-8000-000000012211', current_date - 30, current_date - 1, 'Excellent', null)$$, '22023', null, 'IPER must be adjectival');

select extensions.is(
  (select status from public.list_promotion_candidates_page(null, null, 1, 100) where employee_id = '00000000-0000-4000-8000-000000012211'),
  'for_approval',
  'An active PCPL is listed for approval with its PDF scorecard'
);
select extensions.is(
  (select target_rank_code from public.list_promotion_candidates_page('auto-ready', null, 1, 100)),
  'PSSG',
  'The target rank is the next rank by sort order'
);
select extensions.is(
  (select count(*)::integer from public.list_promotion_candidates_page(null, null, 1, 100) where employee_id = '00000000-0000-4000-8000-000000012212'),
  0,
  'A PAT is outside the PDF scorecard bands and is not listed'
);
select extensions.is(
  public.get_promotion_evaluation('00000000-0000-4000-8000-000000012212') -> 'evaluation' ->> 'reason',
  'below_scored_rank',
  'The PAT evaluation explains why it is not scored'
);
select extensions.is(
  (select count(*)::integer from public.list_promotion_candidates_page(null, null, 1, 100) where employee_id = '00000000-0000-4000-8000-000000012213'),
  0,
  'NUP is never listed'
);
select extensions.throws_ok($$select public.decide_promotion('00000000-0000-4000-8000-000000012211', true, null)$$, 'P0001', null, 'HR cannot decide before the Promotion Board assessments are recorded');
select public.record_promotion_board_assessment('00000000-0000-4000-8000-000000012211', 'board', 'PCPL-PMSG', current_date, 12, 'Panel interview sheet');
select public.record_promotion_board_assessment('00000000-0000-4000-8000-000000012211', 'reputation', 'PCPL-PMSG', current_date, 18, 'Records review');
select extensions.throws_ok($$select public.decide_promotion('00000000-0000-4000-8000-000000012211', false, '  ')$$, '22023', null, 'Rejection needs a reason');
select extensions.lives_ok($$select public.decide_promotion('00000000-0000-4000-8000-000000012211', true, 'Board approved')$$, 'HR approves a qualified employee');
select extensions.is(
  (select status from public.list_promotion_candidates_page(null, 'approved', 1, 100) where employee_id = '00000000-0000-4000-8000-000000012211'),
  'approved',
  'The approved promotion shows as Approved'
);
select extensions.throws_ok($$select public.decide_promotion('00000000-0000-4000-8000-000000012211', false, 'Changed mind')$$, '23505', null, 'A decision is recorded once');

set local role postgres;
select extensions.is(
  (select count(*)::integer from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000012202' and type = 'promotion_decision'),
  1,
  'The employee is notified of the decision'
);
select extensions.is(
  (select code from public.ranks where id = (select rank_id from public.employees where id = '00000000-0000-4000-8000-000000012211')),
  'PCPL',
  'Approval does not change the rank automatically'
);
select public.record_promotion_board_assessment('00000000-0000-4000-8000-000000012211', 'board', 'PCPL-PMSG', current_date, 15, 'Corrected panel sheet');
select extensions.ok(
  (select (evaluation_snapshot ->> 'totalScore')::numeric from public.promotion_decisions where employee_id = '00000000-0000-4000-8000-000000012211')
    < (private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012211', current_date) ->> 'totalScore')::numeric,
  'A later evidence correction changes the live score but not the decision snapshot'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000012202';
select extensions.is(public.get_my_promotion_status() -> 'decision' ->> 'status', 'approved', 'The employee sees the HR decision');
select extensions.ok(
  not exists (select 1 from jsonb_array_elements(public.get_my_promotion_status() -> 'evaluation' -> 'criteria') criterion where criterion ? 'evidence')
    and jsonb_array_length(public.get_my_promotion_status() -> 'evaluation' -> 'criteria') = 6,
  'The employee sees every criterion score but none of the HR evidence'
);
select extensions.throws_ok($$select public.decide_promotion('00000000-0000-4000-8000-000000012212', false, 'Nope')$$, '42501', null, 'Employees cannot decide promotions');
select extensions.throws_ok($$insert into public.promotion_rank_requirements (target_rank_id) values ((select id from public.ranks where code = 'PAT'))$$, '42501', null, 'Employees cannot write requirements');
select extensions.throws_ok($$select public.create_promotion_criterion(2, 1, null, '[]'::jsonb)$$, '42501', null, 'Promotion criteria can no longer be created');

select * from extensions.finish();
rollback;
