import { createClient } from "npm:@supabase/supabase-js@2";

const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";
const WORKER_BATCH_SIZE = 10;

type EmailJob = {
  id: string;
  recipient_user_id: string;
  template_key: string;
  continue_path: string;
};

type EmailTemplate = {
  subject: string;
  copy: string;
};

type ClientFactory = (url: string, key: string, options?: unknown) => any;

type Dependencies = {
  createClient?: ClientFactory;
  getEnv?: (name: string) => string | undefined;
  fetch?: typeof globalThis.fetch;
};

const templates: Record<string, EmailTemplate> = {
  application_update: {
    subject: "Application update",
    copy: "There is an update to your application. Sign in to view it.",
  },
  application_remark: {
    subject: "Application update",
    copy: "A new update was added to your application. Sign in to view it.",
  },
  leave_decision: {
    subject: "Leave request update",
    copy: "Your leave request has been decided. Sign in to view it.",
  },
  profile_change_decision: {
    subject: "Profile-change request update",
    copy: "Your profile-change request has been decided. Sign in to view it.",
  },
  deployment_update: {
    subject: "Deployment update",
    copy: "Your deployment record was updated. Sign in to view it.",
  },
};

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Content-Type": "application/json" } });

function isEmailJob(value: unknown): value is EmailJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Record<string, unknown>;
  return ["id", "recipient_user_id", "template_key", "continue_path"].every((key) => typeof job[key] === "string");
}

function buildContinueUrl(appUrl: string, continuePath: string) {
  const url = new URL("/auth/continue", appUrl);
  url.searchParams.set("next", continuePath);
  return url.toString();
}

function failureForStatus(status: number) {
  return {
    retryable: status === 429 || status >= 500,
    code: status === 429 || status >= 500 ? "provider_unavailable" : "provider_rejected",
    detail: `Brevo returned HTTP ${status}.`,
  };
}

export function createSendNotificationEmailHandler({
  createClient: makeClient = createClient as unknown as ClientFactory,
  getEnv = (name) => Deno.env.get(name),
  fetch: fetchRequest = globalThis.fetch,
}: Dependencies = {}) {
  return async (request: Request) => {
    if (request.method !== "POST") return json(405, { error: "Method not allowed." });

    const workerSecret = getEnv("EMAIL_NOTIFICATION_WORKER_SECRET");
    if (!workerSecret || request.headers.get("x-email-notification-worker-secret") !== workerSecret) {
      return json(401, { error: "Worker authentication is required." });
    }

    const supabaseUrl = getEnv("SUPABASE_URL") ?? "";
    const serviceRoleKey = getEnv("SUPABASE_SECRET_KEY") ?? getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const brevoApiKey = getEnv("BREVO_API_KEY") ?? "";
    const senderEmail = getEnv("BREVO_SENDER_EMAIL") ?? "";
    const senderName = getEnv("BREVO_SENDER_NAME") ?? "";
    const appUrl = getEnv("APP_URL") ?? "";
    let applicationUrl: URL;
    try {
      applicationUrl = new URL(appUrl);
    } catch {
      return json(503, { error: "Email notifications are unavailable." });
    }
    if (!supabaseUrl || !serviceRoleKey || !brevoApiKey || !senderEmail || !senderName || !["http:", "https:"].includes(applicationUrl.protocol)) {
      return json(503, { error: "Email notifications are unavailable." });
    }

    const admin = makeClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error: claimError } = await admin.rpc("claim_notification_email_jobs", { max_jobs: WORKER_BATCH_SIZE });
    if (claimError) return json(500, { error: "Unable to claim email notifications." });

    const jobs = Array.isArray(data) ? data.filter(isEmailJob) : [];
    let accepted = 0;
    let retryable = 0;
    let failed = 0;

    for (const job of jobs) {
      const persistFailure = async (code: string, detail: string, shouldRetry: boolean) => {
        try {
          await admin.rpc("fail_notification_email_job", {
            target_job_id: job.id,
            target_failure_code: code,
            target_failure_detail: detail,
            should_retry: shouldRetry,
          });
        } catch {
          // The stale-job sweeper will recover this lease when persistence is unavailable.
        }
      };

      const template = templates[job.template_key];
      if (!template) {
        await persistFailure("unsupported_template", "The queued template is not supported.", false);
        failed += 1;
        continue;
      }

      let recipientEmail: string | null = null;
      try {
        const { data: recipient, error: recipientError } = await admin.auth.admin.getUserById(job.recipient_user_id);
        recipientEmail = recipientError ? null : recipient.user?.email?.trim() ?? null;
      } catch {
        recipientEmail = null;
      }
      if (!recipientEmail) {
        await persistFailure("recipient_unavailable", "The account has no usable email address.", false);
        failed += 1;
        continue;
      }

      let continueUrl: string;
      try {
        continueUrl = buildContinueUrl(applicationUrl.toString(), job.continue_path);
      } catch {
        await persistFailure("invalid_continue_path", "The queued portal link is invalid.", false);
        failed += 1;
        continue;
      }

      const payload = {
        sender: { email: senderEmail, name: senderName },
        to: [{ email: recipientEmail }],
        subject: template.subject,
        textContent: `${template.copy}\n\nSign in to view: ${continueUrl}`,
        htmlContent: `<p>${template.copy}</p><p><a href="${continueUrl}">Sign in to view</a></p>`,
        tags: [`email-notification:${job.id}`],
      };

      try {
        const response = await fetchRequest(BREVO_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": brevoApiKey },
          body: JSON.stringify(payload),
        });
        if (response.status === 201) {
          let messageId: string | null = null;
          try {
            const responseBody = await response.json() as { messageId?: unknown };
            messageId = typeof responseBody.messageId === "string" && responseBody.messageId.trim()
              ? responseBody.messageId.trim()
              : null;
          } catch {
            messageId = null;
          }
          if (messageId) {
            const { error: completeError } = await admin.rpc("complete_notification_email_job", {
              target_job_id: job.id,
              target_provider_message_id: messageId,
            });
            if (!completeError) accepted += 1;
          } else {
            await persistFailure("provider_invalid_response", "Brevo accepted the request without a message ID.", true);
            retryable += 1;
          }
          continue;
        }

        const failure = failureForStatus(response.status);
        await persistFailure(failure.code, failure.detail, failure.retryable);
        if (failure.retryable) retryable += 1;
        else failed += 1;
      } catch {
        await persistFailure("provider_unavailable", "Could not reach the email provider.", true);
        retryable += 1;
      }
    }

    return json(200, { claimed: jobs.length, accepted, retryable, failed });
  };
}

if (import.meta.main) Deno.serve(createSendNotificationEmailHandler());
