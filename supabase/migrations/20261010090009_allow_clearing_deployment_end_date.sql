-- Client round 5 follow-up (2026-10-10): the deployment form now edits the optional End date, so HR must be
-- able to clear it (a one-day deployment). The old guard existed only because the form never sent end dates.
drop trigger deployments_preserve_historic_end_date on public.deployments;
drop function private.preserve_historic_deployment_end_date();
