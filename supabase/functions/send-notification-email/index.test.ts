import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import { createSendNotificationEmailHandler } from "./index.ts";

type Job = {
  id: string;
  recipient_user_id: string;
  template_key: string;
  continue_path: string;
  notification_title: string;
  notification_body: string;
};

type EmailWorkerClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: null }>;
  auth: {
    admin: {
      getUserById: () => Promise<{ data: { user: { email: string | null } }; error: null }>;
    };
  };
};

const workerSecret = "worker-secret";
const recipientId = "123e4567-e89b-42d3-a456-426614174000";

function workerRequest(secret = workerSecret, method = "POST") {
  return new Request("https://project.supabase.co/functions/v1/send-notification-email", {
    method,
    headers: secret ? { "x-email-notification-worker-secret": secret } : undefined,
  });
}

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    EMAIL_NOTIFICATION_WORKER_SECRET: workerSecret,
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "service-role-key",
    BREVO_API_KEY: "brevo-api-key",
    BREVO_SENDER_EMAIL: "sender@example.test",
    BREVO_SENDER_NAME: "HRIS Notifications",
    APP_URL: "https://portal.example.test",
    ...overrides,
  };
}

function getEnvFrom(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

function job(templateKey: string, suffix = "1"): Job {
  return {
    id: `123e4567-e89b-42d3-a456-42661417400${suffix}`,
    recipient_user_id: recipientId,
    template_key: templateKey,
    continue_path: "/employee/leave?source=notification",
    notification_title: "Leave request approved",
    notification_body: "Your leave request has been approved. Reason: Staffing < coverage.",
  };
}

function createClient(jobs: Job[], options: { email?: string | null; emails?: Array<string | null>; context?: unknown; contextError?: boolean } = {}) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let emailLookupCount = 0;
  const client: EmailWorkerClient = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push({ name, args });
      if (name === "claim_notification_email_jobs") return { data: jobs, error: null };
      if (name === "notification_email_context") {
        if (options.contextError) throw new Error("context lookup failed");
        return { data: options.context ?? {}, error: null };
      }
      return { data: true, error: null };
    },
    auth: {
      admin: {
        getUserById: async () => {
          const configuredEmail = options.emails ? options.emails[emailLookupCount++] : options.email;
          return {
            data: { user: { email: configuredEmail === undefined ? "recipient@example.test" : configuredEmail } },
            error: null,
          };
        },
      },
    },
  };
  return { client, rpcCalls };
}

Deno.test("rejects non-POST requests and requests without the worker secret before any work", async () => {
  let clientsCreated = 0;
  let fetchCalls = 0;
  const handler = createSendNotificationEmailHandler({
    createClient: () => {
      clientsCreated += 1;
      throw new Error("The client must not be created.");
    },
    getEnv: getEnvFrom(environment()),
    fetch: async () => {
      fetchCalls += 1;
      return new Response();
    },
  });

  const methodResponse = await handler(workerRequest(workerSecret, "GET"));
  const missingSecretResponse = await handler(workerRequest(""));
  const wrongSecretResponse = await handler(workerRequest("wrong-secret"));

  assertEquals(methodResponse.status, 405);
  assertEquals(missingSecretResponse.status, 401);
  assertEquals(wrongSecretResponse.status, 401);
  assertEquals(clientsCreated, 0);
  assertEquals(fetchCalls, 0);
});

Deno.test("returns 503 before claiming jobs when notification-email configuration is incomplete", async () => {
  let clientsCreated = 0;
  const handler = createSendNotificationEmailHandler({
    createClient: () => {
      clientsCreated += 1;
      throw new Error("The client must not be created.");
    },
    getEnv: getEnvFrom(environment({ BREVO_API_KEY: undefined })),
  });

  const response = await handler(workerRequest());

  assertEquals(response.status, 503);
  assertEquals(await response.json(), { error: "Email notifications are unavailable." });
  assertEquals(clientsCreated, 0);
});

Deno.test("rejects an unsupported portal URL scheme before claiming jobs", async () => {
  let clientsCreated = 0;
  const handler = createSendNotificationEmailHandler({
    createClient: () => {
      clientsCreated += 1;
      throw new Error("The client must not be created.");
    },
    getEnv: getEnvFrom(environment({ APP_URL: "httpx://portal.example.test" })),
  });

  const response = await handler(workerRequest());

  assertEquals(response.status, 503);
  assertEquals(clientsCreated, 0);
});

for (const templateKey of ["application_update", "application_remark", "leave_decision", "profile_change_decision"]) {
  Deno.test(`sends the queued ${templateKey} notification content through Brevo`, async () => {
    const currentJob = job(templateKey);
    const { client, rpcCalls } = createClient([currentJob]);
    const requests: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
    const handler = createSendNotificationEmailHandler({
      createClient: () => client,
      getEnv: getEnvFrom(environment()),
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ input, init });
        return Response.json({ messageId: "<brevo-message@example.test>" }, { status: 201 });
      },
    });

    const response = await handler(workerRequest());
    const payload = JSON.parse(String(requests[0].init?.body));
    const protectedLink = "https://portal.example.test/auth/continue?next=%2Femployee%2Fleave%3Fsource%3Dnotification";

    assertEquals(response.status, 200);
    assertEquals(new URL(String(requests[0].input)).href, "https://api.brevo.com/v3/smtp/email");
    assertEquals(new Headers(requests[0].init?.headers).get("api-key"), "brevo-api-key");
    assertEquals(payload.sender, { email: "sender@example.test", name: "HRIS Notifications" });
    assertEquals(payload.to, [{ email: "recipient@example.test" }]);
    assertEquals(payload.tags, [`email-notification:${currentJob.id}`]);
    assertEquals(payload.subject, currentJob.notification_title);
    assertStringIncludes(payload.textContent, currentJob.notification_body);
    assertStringIncludes(payload.textContent, protectedLink);
    assertStringIncludes(payload.htmlContent, "Your leave request has been approved. Reason: Staffing &lt; coverage.");
    assertEquals(payload.htmlContent.includes("Staffing < coverage"), false);
    assertStringIncludes(payload.htmlContent, protectedLink);
    assertEquals(rpcCalls.find((entry) => entry.name === "notification_email_context")?.args, { target_job_id: currentJob.id });
    assertEquals(rpcCalls.at(-1), {
      name: "complete_notification_email_job",
      args: { target_job_id: currentJob.id, target_provider_message_id: "<brevo-message@example.test>" },
    });
  });
}

async function sendOne(currentJob: Job, options: Parameters<typeof createClient>[1] = {}) {
  const { client } = createClient([currentJob], options);
  const bodies: string[] = [];
  const handler = createSendNotificationEmailHandler({
    createClient: () => client,
    getEnv: getEnvFrom(environment()),
    fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return Response.json({ messageId: "<brevo-message@example.test>" }, { status: 201 });
    },
  });
  const response = await handler(workerRequest());
  assertEquals(response.status, 200);
  return JSON.parse(bodies[0]) as { htmlContent: string; textContent: string };
}

Deno.test("applicant emails follow emailud.html with the applicant's name, number, status and submission date", async () => {
  const payload = await sendOne(
    { ...job("application_update"), continue_path: "/applicant/applications", notification_title: "Application updated", notification_body: "Your application was received." },
    { context: { applicant_first_name: "Aldrick", applicant_number: "2-61234", application_status: "Application Submission", application_submitted_at: "2026-10-11T02:00:00Z" } },
  );

  assertStringIncludes(payload.htmlContent, "border-bottom: 4px solid #CE1126;");
  assertStringIncludes(payload.htmlContent, "Human Resource Information System");
  assertStringIncludes(payload.htmlContent, "Greetings, Aldrick!");
  assertStringIncludes(payload.htmlContent, "We would like to inform you that your application status has been updated.");
  assertStringIncludes(payload.htmlContent, "&#9679; Application Received");
  assertStringIncludes(payload.htmlContent, '<strong>Applicant Number:</strong> <span style="color: #CE1126;">2-61234</span>');
  assertStringIncludes(payload.htmlContent, "<strong>Submission Date:</strong> October 11, 2026");
  assertStringIncludes(payload.htmlContent, ">Applicant Login</a>");
  assertStringIncludes(payload.htmlContent, "Hotline: 0917-773-7885");
  assertStringIncludes(payload.textContent, "Applicant Number: 2-61234");
  assertStringIncludes(payload.textContent, "Applicant Login: https://portal.example.test/auth/continue?next=%2Fapplicant%2Fapplications");
});

Deno.test("deployment emails follow emailemp.html with rank and name, badge number, post and effective date", async () => {
  const payload = await sendOne(
    { ...job("deployment_update"), continue_path: "/employee/deployments", notification_title: "New deployment assigned", notification_body: "You are deployed to Checkpoint 3 starting October 12, 2026." },
    { context: { rank_code: "PCPL", employee_first_name: "Juan", employee_last_name: "Dela Cruz", badge_number: "1-23456", deployment_location: "Checkpoint 3 <North>", deployment_starts_on: "2026-10-12", deployment_ends_on: null } },
  );

  assertStringIncludes(payload.htmlContent, "Human Resource Information System &bull; Personnel Gateway");
  assertStringIncludes(payload.htmlContent, "Greetings, PCPL Juan Dela Cruz!");
  assertStringIncludes(payload.htmlContent, "<strong>Official Deployment Order / Duty Assignment</strong>");
  assertStringIncludes(payload.htmlContent, "Special Order / Deployment Summary");
  assertStringIncludes(payload.htmlContent, "&#9679; Deployment Order Issued");
  assertStringIncludes(payload.htmlContent, "1-23456");
  assertStringIncludes(payload.htmlContent, "<strong>Assignment / Post:</strong> Checkpoint 3 &lt;North&gt;");
  assertStringIncludes(payload.htmlContent, "<strong>Effective Date:</strong> October 12, 2026");
  assertStringIncludes(payload.htmlContent, ">Personnel Portal Access</a>");
  assertStringIncludes(payload.htmlContent, "Administrative Section Hotline: 0917-773-7885");
  assertEquals(payload.htmlContent.includes("Checkpoint 3 <North>"), false);
  assertStringIncludes(payload.textContent, "Assignment / Post: Checkpoint 3 <North>");
});

Deno.test("still sends a generic personnel email when the recipient details cannot be loaded", async () => {
  const payload = await sendOne(job("leave_decision"), { contextError: true });

  assertStringIncludes(payload.htmlContent, "Greetings, Personnel!");
  assertStringIncludes(payload.htmlContent, "&#9679; Leave request approved");
  assertStringIncludes(payload.htmlContent, "Staffing &lt; coverage.");
});

Deno.test("retries a malformed successful provider response and transient provider failures", async () => {
  const firstJob = job("leave_decision", "2");
  const secondJob = job("leave_decision", "3");
  const thirdJob = job("leave_decision", "4");
  const { client, rpcCalls } = createClient([firstJob, secondJob, thirdJob]);
  let call = 0;
  const handler = createSendNotificationEmailHandler({
    createClient: () => client,
    getEnv: getEnvFrom(environment()),
    fetch: async () => {
      call += 1;
      if (call === 1) return Response.json({}, { status: 201 });
      if (call === 2) return new Response("busy", { status: 429 });
      throw new TypeError("network unavailable");
    },
  });

  const response = await handler(workerRequest());
  const failures = rpcCalls.filter((entry) => entry.name === "fail_notification_email_job");

  assertEquals(response.status, 200);
  assertEquals(failures.map((entry) => entry.args.should_retry), [true, true, true]);
  assertEquals(failures.map((entry) => entry.args.target_job_id), [firstJob.id, secondJob.id, thirdJob.id]);
});

Deno.test("records a terminal failure for a Brevo validation error or missing recipient email", async () => {
  const validationJob = job("deployment_update", "5");
  const missingRecipientJob = job("deployment_update", "6");
  const { client, rpcCalls } = createClient([validationJob, missingRecipientJob], {
    emails: ["recipient@example.test", null],
  });
  let fetchCalls = 0;
  const handler = createSendNotificationEmailHandler({
    createClient: () => client,
    getEnv: getEnvFrom(environment()),
    fetch: async () => {
      fetchCalls += 1;
      return new Response("invalid recipient", { status: 400 });
    },
  });

  const response = await handler(workerRequest());
  const failures = rpcCalls.filter((entry) => entry.name === "fail_notification_email_job");

  assertEquals(response.status, 200);
  assertEquals(fetchCalls, 1);
  assertEquals(failures.map((entry) => entry.args.should_retry), [false, false]);
  assertEquals(failures.map((entry) => entry.args.target_job_id), [validationJob.id, missingRecipientJob.id]);
});

Deno.test("continues sending later jobs after one job is rejected", async () => {
  const rejectedJob = job("application_update", "7");
  const acceptedJob = job("application_update", "8");
  const { client, rpcCalls } = createClient([rejectedJob, acceptedJob]);
  let call = 0;
  const handler = createSendNotificationEmailHandler({
    createClient: () => client,
    getEnv: getEnvFrom(environment()),
    fetch: async () => {
      call += 1;
      return call === 1
        ? new Response("invalid recipient", { status: 400 })
        : Response.json({ messageId: "<later-success@example.test>" }, { status: 201 });
    },
  });

  const response = await handler(workerRequest());

  assertEquals(response.status, 200);
  assertEquals(rpcCalls.filter((entry) => entry.name === "fail_notification_email_job").length, 1);
  assertEquals(rpcCalls.at(-1), {
    name: "complete_notification_email_job",
    args: { target_job_id: acceptedJob.id, target_provider_message_id: "<later-success@example.test>" },
  });
});
