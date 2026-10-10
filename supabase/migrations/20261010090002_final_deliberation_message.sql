-- Client round 5 (2026-10-10): the Final Evaluation note reads "Under Final Deliberation".
create or replace function private.application_status_message(target_status text)
returns text language sql immutable set search_path = '' as $$
  select case target_status
    when 'Application Submission' then 'Your application is now under review.'
    when 'Physical Agility Test' then 'You are scheduled for the Physical Agility Test.'
    when 'Physical & Medical Examination' then 'You are proceeding to the Physical & Medical Examination.'
    when 'Neuro-Psychiatric Examination' then 'You are proceeding to the Neuro-Psychiatric Examination.'
    when 'Drug Test' then 'You are proceeding to the Drug Test.'
    when 'Character & Background Investigation' then 'Your character and background investigation is in progress.'
    when 'Panel Interview' then 'You are proceeding to the Panel Interview.'
    when 'Final Evaluation' then 'Your application is under final deliberation.'
    when 'Shortlisted' then 'You have been shortlisted.'
    when 'Not Selected' then 'You were not selected for this opening.'
    else 'Your application status is now ' || target_status || '.'
  end;
$$;

revoke all on function private.application_status_message(text) from public, anon, authenticated;
