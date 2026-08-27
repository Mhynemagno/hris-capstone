import { createClient } from "npm:@supabase/supabase-js@2";

import {
  GeminiApplicationScoringProvider,
  type ApplicationDocumentInput,
  type ApplicationScoringResult,
} from "../_shared/application-scoring-provider.ts";

const QUEUE_NAME = "application_analysis";
const WORKER_BATCH_SIZE = 5;

type QueueMessage = { msg_id: bigint; message: { scoreId?: unknown } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientFactory = (url: string, key: string, options?: unknown) => any;
type AnalyzeDocuments = (input: {
  documents: ApplicationDocumentInput[];
  criteria: Array<{ kind: string; requirement: string; isRequired: boolean }>;
}) => Promise<ApplicationScoringResult>;

type Dependencies = {
  createClient?: ClientFactory;
  getEnv?: (name: string) => string | undefined;
  analyzeDocuments?: AnalyzeDocuments;
  now?: () => Date;
};

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Content-Type": "application/json" } });

function failureCode(cause: unknown) {
  return cause instanceof Error && ["provider_unavailable", "provider_invalid_response", "persistence_failed"].includes(cause.message)
    ? cause.message
    : "provider_unavailable";
}

function isScoreId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createProcessApplicationAnalysisHandler({
  createClient: makeClient = createClient as unknown as ClientFactory,
  getEnv = (name) => Deno.env.get(name),
  analyzeDocuments,
  now = () => new Date(),
}: Dependencies = {}) {
  return async (request: Request) => {
    if (request.method !== "POST") return json(405, { error: "Method not allowed." });
    const workerSecret = getEnv("ANALYSIS_WORKER_SECRET");
    if (!workerSecret || request.headers.get("x-analysis-worker-secret") !== workerSecret) {
      return json(401, { error: "Worker authentication is required." });
    }

    const url = getEnv("SUPABASE_URL") ?? "";
    const secretKey = getEnv("SUPABASE_SECRET_KEY") ?? getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const apiKey = getEnv("GEMINI_API_KEY");
    if (!url || !secretKey || !apiKey) return json(503, { error: "AI analysis is unavailable." });

    const admin = makeClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const provider = new GeminiApplicationScoringProvider(apiKey);
    const analyzer = analyzeDocuments ?? provider.analyzeDocuments.bind(provider);
    const { data: messages, error: readError } = await admin.schema("pgmq_public").rpc("read", {
      queue_name: QUEUE_NAME,
      sleep_seconds: 0,
      n: WORKER_BATCH_SIZE,
    });
    if (readError) return json(500, { error: "Unable to read application analysis queue." });

    let processed = 0;
    for (const message of (messages ?? []) as QueueMessage[]) {
      if (!isScoreId(message.message?.scoreId)) {
        await admin.schema("pgmq_public").rpc("delete", { queue_name: QUEUE_NAME, msg_id: message.msg_id });
        continue;
      }

      const startedAt = now().toISOString();
      const { data: attempt, error: claimError } = await admin
        .from("application_ai_scores")
        .update({ status: "processing", processing_started_at: startedAt })
        .eq("id", message.message.scoreId)
        .eq("status", "queued")
        .select("id, application_id, attempt_count")
        .maybeSingle();
      if (claimError) continue;
      if (!attempt) {
        await admin.schema("pgmq_public").rpc("delete", { queue_name: QUEUE_NAME, msg_id: message.msg_id });
        continue;
      }

      try {
        const { data: application, error: applicationError } = await admin
          .from("applications")
          .select("id, job_opening_id")
          .eq("id", attempt.application_id)
          .maybeSingle();
        if (applicationError || !application) throw new Error("persistence_failed");

        const { data: documentRows, error: documentError } = await admin
          .from("applicant_documents")
          .select("object_path, file_name, mime_type")
          .eq("application_id", application.id)
          .order("created_at");
        if (documentError || !documentRows?.length) throw new Error("persistence_failed");

        const documents: ApplicationDocumentInput[] = [];
        for (const document of documentRows) {
          const { data: file, error: downloadError } = await admin.storage.from("applicant-documents").download(document.object_path);
          if (downloadError || !file) throw new Error("persistence_failed");
          documents.push({
            fileName: document.file_name,
            mimeType: document.mime_type,
            bytes: new Uint8Array(await file.arrayBuffer()),
          });
        }

        const { data: criteria, error: criteriaError } = await admin
          .from("job_qualification_criteria")
          .select("kind, requirement, is_required")
          .eq("job_opening_id", application.job_opening_id)
          .order("ordinal");
        if (criteriaError || !criteria?.length) throw new Error("persistence_failed");

        const result = await analyzer({
          documents,
          criteria: criteria.map((item: { kind: string; requirement: string; is_required: boolean }) => ({
            kind: item.kind,
            requirement: item.requirement,
            isRequired: item.is_required,
          })),
        });
        const completedAt = now().toISOString();
        const { error: completeError } = await admin
          .from("application_ai_scores")
          .update({
            status: "completed",
            score: result.score,
            explanation: result.explanation,
            provider: result.provider,
            model: result.model,
            model_version: result.modelVersion,
            completed_at: completedAt,
          })
          .eq("id", attempt.id);
        if (completeError) throw new Error("persistence_failed");
        const { error: auditError } = await admin.from("audit_logs").insert({
          actor_user_id: null,
          entity_type: "applications",
          entity_id: attempt.application_id,
          action: "ai_scored",
          metadata: { score_id: attempt.id, status: "completed", provider: result.provider, model: result.model },
        });
        if (auditError) throw new Error("persistence_failed");
        await admin.schema("pgmq_public").rpc("delete", { queue_name: QUEUE_NAME, msg_id: message.msg_id });
        processed += 1;
      } catch (cause) {
        const code = failureCode(cause);
        if (attempt.attempt_count < 1) {
          const queuedAt = now().toISOString();
          const { error: retryError } = await admin
            .from("application_ai_scores")
            .update({ status: "queued", attempt_count: attempt.attempt_count + 1, queued_at: queuedAt, processing_started_at: null })
            .eq("id", attempt.id);
          if (retryError) continue;
          const { error: enqueueError } = await admin.schema("pgmq_public").rpc("send", {
            queue_name: QUEUE_NAME,
            message: { scoreId: attempt.id },
            sleep_seconds: 300,
          });
          if (enqueueError) continue;
        } else {
          const completedAt = now().toISOString();
          await admin
            .from("application_ai_scores")
            .update({ status: "failed", failure_code: code, completed_at: completedAt })
            .eq("id", attempt.id);
        }
        await admin.schema("pgmq_public").rpc("delete", { queue_name: QUEUE_NAME, msg_id: message.msg_id });
      }
    }

    return json(200, { processed });
  };
}

if (import.meta.main) Deno.serve(createProcessApplicationAnalysisHandler());
