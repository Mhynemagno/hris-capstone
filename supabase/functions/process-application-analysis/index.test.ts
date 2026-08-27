import { assertEquals } from "jsr:@std/assert@1";

import { createProcessApplicationAnalysisHandler } from "./index.ts";

const scoreId = "123e4567-e89b-42d3-a456-426614174000";
const applicationId = "123e4567-e89b-42d3-a456-426614174001";

function workerRequest(secret?: string) {
  return new Request("https://project.supabase.co/functions/v1/process-application-analysis", {
    method: "POST",
    headers: secret ? { "x-analysis-worker-secret": secret } : undefined,
  });
}

Deno.test("rejects queue processing without the worker secret", async () => {
  const handler = createProcessApplicationAnalysisHandler({
    getEnv: (name: string) => ({ ANALYSIS_WORKER_SECRET: "worker-secret" } as Record<string, string>)[name],
  });

  const response = await handler(workerRequest());

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: "Worker authentication is required." });
});

Deno.test("processes a queued application without returning document content", async () => {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const auditMetadata: Array<Record<string, unknown>> = [];
  const deletedMessages: bigint[] = [];
  const downloadedPaths: string[] = [];

  const client = {
    schema: () => ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === "read") {
          assertEquals(args, { queue_name: "application_analysis", sleep_seconds: 0, n: 5 });
          return { data: [{ msg_id: 7n, message: { scoreId } }], error: null };
        }
        if (name === "delete") {
          deletedMessages.push(args.msg_id as bigint);
          return { data: true, error: null };
        }
        throw new Error(`Unexpected queue RPC: ${name}`);
      },
    }),
    from: (table: string) => ({
      update(values: Record<string, unknown>) {
        updates.push({ table, values });
        const query = {
          eq: () => query,
          select: () => ({
            maybeSingle: async () => ({ data: { id: scoreId, application_id: applicationId, attempt_count: 0 }, error: null }),
          }),
          then: (resolve: (value: { data: { id: string }; error: null }) => unknown) => Promise.resolve({ data: { id: scoreId }, error: null }).then(resolve),
        };
        return query;
      },
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: applicationId, job_opening_id: 42 }, error: null }),
          order: async () => {
            if (table === "applicant_documents") {
              return {
                data: [{ object_path: "applicants/user/application/cv.pdf", file_name: "cv.pdf", mime_type: "application/pdf" }],
                error: null,
              };
            }
            return { data: [{ kind: "experience", requirement: "Two years", is_required: true }], error: null };
          },
        }),
      }),
      insert: async (values: Record<string, unknown>) => {
        if (table === "audit_logs") auditMetadata.push(values.metadata as Record<string, unknown>);
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        download: async (path: string) => {
          downloadedPaths.push(path);
          return { data: new Blob([new Uint8Array([1, 2, 3])]), error: null };
        },
      }),
    },
  };

  const handler = createProcessApplicationAnalysisHandler({
    createClient: () => client,
    getEnv: (name: string) => ({
      ANALYSIS_WORKER_SECRET: "worker-secret",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "service-key",
      GEMINI_API_KEY: "gemini-key",
    } as Record<string, string>)[name],
    analyzeDocuments: async () => ({
      score: 86,
      explanation: "Meets the required experience criterion.",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      modelVersion: "v1beta",
    }),
  });

  const response = await handler(workerRequest("worker-secret"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { processed: 1 });
  assertEquals(downloadedPaths, ["applicants/user/application/cv.pdf"]);
  assertEquals(deletedMessages, [7n]);
  assertEquals(updates.map((entry) => entry.values.status), ["processing", "completed"]);
  assertEquals(auditMetadata, [{ score_id: scoreId, status: "completed", provider: "gemini", model: "gemini-2.5-flash-lite" }]);
  assertEquals(JSON.stringify(auditMetadata).includes("AQID"), false);
});

Deno.test("requeues a transient provider failure once before deleting its message", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const queueCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    schema: () => ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        queueCalls.push({ name, args });
        if (name === "read") return { data: [{ msg_id: 8n, message: { scoreId } }], error: null };
        return { data: true, error: null };
      },
    }),
    from: (table: string) => ({
      update(values: Record<string, unknown>) {
        updates.push(values);
        const query = {
          eq: () => query,
          select: () => ({
            maybeSingle: async () => ({ data: { id: scoreId, application_id: applicationId, attempt_count: 0 }, error: null }),
          }),
          then: (resolve: (value: { data: { id: string }; error: null }) => unknown) => Promise.resolve({ data: { id: scoreId }, error: null }).then(resolve),
        };
        return query;
      },
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: applicationId, job_opening_id: 42 }, error: null }),
          order: async () => table === "applicant_documents"
            ? { data: [{ object_path: "applicants/user/application/cv.pdf", file_name: "cv.pdf", mime_type: "application/pdf" }], error: null }
            : { data: [{ kind: "experience", requirement: "Two years", is_required: true }], error: null },
        }),
      }),
      insert: async () => ({ error: null }),
    }),
    storage: {
      from: () => ({ download: async () => ({ data: new Blob(["CV"]), error: null }) }),
    },
  };
  const handler = createProcessApplicationAnalysisHandler({
    createClient: () => client,
    getEnv: (name: string) => ({
      ANALYSIS_WORKER_SECRET: "worker-secret",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "service-key",
      GEMINI_API_KEY: "gemini-key",
    } as Record<string, string>)[name],
    analyzeDocuments: async () => { throw new Error("provider_unavailable"); },
  });

  const response = await handler(workerRequest("worker-secret"));

  assertEquals(response.status, 200);
  assertEquals(updates.map((entry) => entry.status), ["processing", "queued"]);
  assertEquals(queueCalls, [
    { name: "read", args: { queue_name: "application_analysis", sleep_seconds: 0, n: 5 } },
    { name: "send", args: { queue_name: "application_analysis", message: { scoreId }, sleep_seconds: 300 } },
    { name: "delete", args: { queue_name: "application_analysis", msg_id: 8n } },
  ]);
});

Deno.test("records a terminal failure after the automatic retry was used", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const queueCalls: string[] = [];
  const client = {
    schema: () => ({
      rpc: async (name: string) => {
        queueCalls.push(name);
        if (name === "read") return { data: [{ msg_id: 9n, message: { scoreId } }], error: null };
        return { data: true, error: null };
      },
    }),
    from: (table: string) => ({
      update(values: Record<string, unknown>) {
        updates.push(values);
        const query = {
          eq: () => query,
          select: () => ({
            maybeSingle: async () => ({ data: { id: scoreId, application_id: applicationId, attempt_count: 1 }, error: null }),
          }),
          then: (resolve: (value: { data: { id: string }; error: null }) => unknown) => Promise.resolve({ data: { id: scoreId }, error: null }).then(resolve),
        };
        return query;
      },
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: applicationId, job_opening_id: 42 }, error: null }),
          order: async () => table === "applicant_documents"
            ? { data: [{ object_path: "applicants/user/application/cv.pdf", file_name: "cv.pdf", mime_type: "application/pdf" }], error: null }
            : { data: [{ kind: "experience", requirement: "Two years", is_required: true }], error: null },
        }),
      }),
      insert: async () => ({ error: null }),
    }),
    storage: { from: () => ({ download: async () => ({ data: new Blob(["CV"]), error: null }) }) },
  };
  const handler = createProcessApplicationAnalysisHandler({
    createClient: () => client,
    getEnv: (name: string) => ({
      ANALYSIS_WORKER_SECRET: "worker-secret",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "service-key",
      GEMINI_API_KEY: "gemini-key",
    } as Record<string, string>)[name],
    analyzeDocuments: async () => { throw new Error("provider_invalid_response"); },
  });

  const response = await handler(workerRequest("worker-secret"));

  assertEquals(response.status, 200);
  assertEquals(updates.map((entry) => entry.status), ["processing", "failed"]);
  assertEquals(updates[1].failure_code, "provider_invalid_response");
  assertEquals(queueCalls, ["read", "delete"]);
});
