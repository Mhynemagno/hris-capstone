# Notification email delivery setup

The HRIS has two separate Brevo integrations:

- **Supabase Auth SMTP** continues to deliver invitation, confirmation, recovery, and account-security emails. Leave the existing SMTP configuration unchanged.
- **HRIS workflow notifications** use the `send-notification-email` Edge Function and Brevo's transactional HTTPS endpoint, `https://api.brevo.com/v3/smtp/email`.

The notification worker sends only these generic messages after a matching in-app notification is created:

| Notification type | Generic email message |
| --- | --- |
| `application_status_updated` | There is an update to your application. Sign in to view it. |
| `application_remark_added` | A new update was added to your application. Sign in to view it. |
| `leave_request_decision` | Your leave request has been decided. Sign in to view it. |
| `profile_change_decision` | Your profile-change request has been decided. Sign in to view it. |
| `deployment_assigned`, `deployment_updated` | Your deployment record was updated. Sign in to view it. |

`password_changed` stays in-app only because Supabase Auth already owns the corresponding security email. No workflow email contains a status detail, remark, decision rationale, deployment location, document name, attachment, or the original notification body.

## 1. Apply the migration and deploy the worker

Apply migration `20261008120000_brevo_email_notifications.sql` through the normal Supabase deployment process, then deploy the worker:

```powershell
npx supabase@latest functions deploy send-notification-email --project-ref <project-ref> --use-api
```

`supabase/config.toml` sets `verify_jwt = false` only for this worker. It authenticates the scheduler using the `x-email-notification-worker-secret` header instead of a browser JWT.

## 2. Set Edge Function secrets

Generate a long random value for the worker secret, then configure the following server-only secrets. Do not put their values in source control, `.env` files committed to Git, or `NEXT_PUBLIC_*` variables.

```powershell
npx supabase@latest secrets set --project-ref <project-ref> `
  BREVO_API_KEY="<Brevo transactional API key>" `
  BREVO_SENDER_EMAIL="<existing registered sender email>" `
  BREVO_SENDER_NAME="<existing sender name>" `
  EMAIL_NOTIFICATION_WORKER_SECRET="<long random worker secret>" `
  APP_URL="https://<deployed-hris-origin>"
```

- `BREVO_API_KEY` is a transactional API key, not the SMTP password already configured in Supabase Auth.
- `BREVO_SENDER_EMAIL` and `BREVO_SENDER_NAME` must preserve the existing sender approved in Brevo. Do not copy the sender address into this document or source code.
- `EMAIL_NOTIFICATION_WORKER_SECRET` protects the scheduled endpoint.
- `APP_URL` is the public HRIS application origin. It is used only to create the protected `/auth/continue?next=...` link.
- Supabase automatically supplies `SUPABASE_URL` and the service-role key to the Edge Function. Do not configure either in browser code.

## 3. Store the scheduler secret in Vault

The migration's every-minute `pg_cron` tick reads two Vault values:

- `project_url`: the Supabase project URL, such as `https://<project-ref>.supabase.co`; reuse the value already required by the applicant-analysis worker.
- `email_notification_worker_secret`: exactly the same random value as `EMAIL_NOTIFICATION_WORKER_SECRET`.

For a new Vault entry, use the Supabase SQL editor:

```sql
select vault.create_secret('<long random worker secret>', 'email_notification_worker_secret');
```

To rotate it, find the existing secret ID with `select id, name from vault.secrets;`, update the Vault value, and immediately update the Edge Function secret to the same new value. Never put the random value, a Brevo key, an SMTP password, or a personal sender address into a migration or SQL history.

## 4. Controlled-recipient smoke test

1. Use a controlled account with a valid email address and trigger one allowed workflow event.
2. Confirm the recipient receives one in-app notification and one generic email with a sign-in link.
3. Confirm the outbox job moves to `accepted` and records a Brevo message ID. `accepted` means Brevo accepted the request; delivery/bounce webhooks are not part of this release.
4. Confirm the email reveals none of the protected workflow details listed above.

## Troubleshooting

Inspect the scheduler and its HTTP calls in the Supabase SQL editor:

```sql
select jobid, jobname, schedule from cron.job where jobname = 'send-notification-email';
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
select status_code, content, created from net._http_response order by created desc limit 10;
```

Also inspect the `send-notification-email` Edge Function logs without copying recipient addresses, API keys, or provider response bodies into tickets.

- **401:** `EMAIL_NOTIFICATION_WORKER_SECRET` and Vault `email_notification_worker_secret` do not match, or the worker secret is missing.
- **503:** one or more required function secrets are missing, or `APP_URL` is not an `http` or `https` origin.
- **Brevo validation rejection / terminal `failed` outbox job:** confirm the controlled recipient and the existing Brevo sender are accepted by Brevo; correct the configuration, then create a new allowed notification to test again.
- **Retryable `pending` outbox job:** Brevo rate limits, provider 5xx responses, and network failures retry after 5 minutes, 30 minutes, then 2 hours. After four attempts the job becomes `failed`.
- **Job remains `sending`:** after 15 minutes the next tick recovers it to `pending` for a retry.
