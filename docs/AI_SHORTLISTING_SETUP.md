# AI applicant shortlisting setup

When an applicant submits an application, the database queues an AI analysis attempt
(`application_ai_scores` row with status `queued` plus a message on the `application_analysis`
queue). A `pg_cron` job (`process-application-analysis`, every minute, created by migration
`20260924112000_application_analysis_schedule.sql`) then:

1. fails any attempt left `queued` or `processing` for more than 15 minutes with failure code
   `timed_out` ("Analysis timed out" in HR, with a Retry button), and
2. calls the `process-application-analysis` Edge Function, which reads the queue, sends the
   application documents and job criteria to Gemini, and saves the score.

HR's application screens refresh every 5 seconds while an attempt is queued or processing.
HR always makes the final decision; a recommendation never changes an application status.

The migration creates the schedule, but the worker only runs once the steps below are done. Until
then every attempt times out after 15 minutes.

## 1. Deploy the worker

```powershell
npx supabase functions deploy process-application-analysis
```

`supabase/config.toml` sets `verify_jwt = false` for this function. It authenticates every call
with the `x-analysis-worker-secret` header, so the cron job does not need a user JWT.

## 2. Set the function secrets

Generate a long random worker secret first (for example `openssl rand -hex 32`), then run:

```powershell
npx supabase secrets set GEMINI_API_KEY="<your Gemini API key>" ANALYSIS_WORKER_SECRET="<worker secret>"
```

`SUPABASE_URL` and the service-role key are provided to Edge Functions automatically.

## 3. Store the cron job's secrets in Vault

Run this in the Supabase SQL editor, using the same worker secret as step 2:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<worker secret>', 'analysis_worker_secret');
```

To change a value later, use `vault.update_secret(<id>, '<new value>')` with the id from
`select id, name from vault.secrets;`.

Never put these values in migrations, source control, or `NEXT_PUBLIC_*` variables.

## 4. Verify

1. Submit a test application as an applicant (use only dummy or consented documents).
2. Within about two minutes, HR's application page should show a score.
3. If it doesn't, check the scheduler and the worker calls:

```sql
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select status_code, content, created from net._http_response order by created desc limit 5;
```

- `401` responses mean `ANALYSIS_WORKER_SECRET` and the Vault `analysis_worker_secret` differ.
- `503` responses mean `GEMINI_API_KEY` is missing.
- No responses at all mean the Vault secrets are missing (the tick skips the call without them).

4. Confirm Applicant, Employee, Management, and anonymous accounts cannot read or write AI scores.
