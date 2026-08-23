import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";

import { GeminiApplicationScoringProvider } from "../_shared/application-scoring-provider.ts";

const inputSchema = z.object({
  applicationId: z.uuid(),
  cvText: z.string().trim().min(80).max(30_000),
  confirmedAnonymized: z.literal(true),
});

const json = (status: number, body: Record<string, string>) => Response.json(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientFactory = (url: string, key: string, options?: unknown) => any;
type Dependencies = { createClient?: ClientFactory; getEnv?: (name: string) => string | undefined };

export function createScoreApplicationHandler({ createClient: makeClient = createClient as unknown as ClientFactory, getEnv = (name) => Deno.env.get(name) }: Dependencies = {}) {
  return async (request: Request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json(405, { error: "Method not allowed." });
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Authentication is required." });
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json(400, { error: "Invalid analysis request." });
    const url = getEnv("SUPABASE_URL") ?? "";
    const publishableKey = getEnv("SUPABASE_PUBLISHABLE_KEY") ?? getEnv("SUPABASE_ANON_KEY") ?? "";
    const secretKey = getEnv("SUPABASE_SECRET_KEY") ?? getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const apiKey = getEnv("GEMINI_API_KEY");
    if (!url || !publishableKey || !secretKey || !apiKey) return json(503, { error: "AI analysis is unavailable." });
    const caller = makeClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    if (userError || !userData.user) return json(401, { error: "Authentication is required." });
    const { data: role } = await caller.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
    if (role?.role !== "hr_personnel") return json(403, { error: "HR access is required." });
    const admin = makeClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: application } = await admin.from("applications").select("job_opening_id").eq("id", parsed.data.applicationId).maybeSingle();
    if (!application) return json(404, { error: "Unable to score this application." });
    const { data: criteria } = await admin.from("job_qualification_criteria").select("kind, requirement, is_required").eq("job_opening_id", application.job_opening_id).order("ordinal");
    if (!criteria?.length) return json(422, { error: "Unable to score this application." });
    const { data: pending, error: pendingError } = await admin.from("application_ai_scores").insert({ application_id: parsed.data.applicationId, requested_by_user_id: userData.user.id, status: "pending" }).select("id").single();
    if (pendingError || !pending) return json(500, { error: "Unable to score this application." });
    try {
      const result = await new GeminiApplicationScoringProvider(apiKey).score({ cvText: parsed.data.cvText, criteria: criteria.map((item: { kind: string; requirement: string; is_required: boolean }) => ({ kind: item.kind, requirement: item.requirement, isRequired: item.is_required })) });
      const { error } = await admin.from("application_ai_scores").update({ status: "completed", score: result.score, explanation: result.explanation, provider: result.provider, model: result.model, model_version: result.modelVersion, completed_at: new Date().toISOString() }).eq("id", pending.id);
      if (error) throw new Error("persistence_failed");
      await admin.from("audit_logs").insert({ actor_user_id: userData.user.id, entity_type: "applications", entity_id: parsed.data.applicationId, action: "ai_scored", metadata: { score_id: pending.id, status: "completed", provider: result.provider, model: result.model } });
      return json(201, { scoreId: pending.id, status: "completed" });
    } catch (cause) {
      const code = cause instanceof Error && ["provider_unavailable", "provider_invalid_response", "persistence_failed"].includes(cause.message) ? cause.message : "provider_unavailable";
      await admin.from("application_ai_scores").update({ status: "failed", failure_code: code, completed_at: new Date().toISOString() }).eq("id", pending.id);
      return json(502, { error: "Unable to score this application." });
    }
  };
}

if (import.meta.main) Deno.serve(createScoreApplicationHandler());
