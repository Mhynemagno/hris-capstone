import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";

type ClientFactory = (url: string, key: string, options?: unknown) => any;
type HandlerDependencies = {
  createClient?: ClientFactory;
  getEnv?: (name: string) => string | undefined;
};

const inputSchema = z.object({ userId: z.uuid() });

const json = (status: number, body: Record<string, string>) =>
  Response.json(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export function createDeleteManagedUserHandler(
  {
    createClient: createSupabaseClient =
      createClient as unknown as ClientFactory,
    getEnv = (name) => Deno.env.get(name),
  }: HandlerDependencies = {},
) {
  return async (request: Request) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (request.method !== "DELETE") {
      return json(405, { error: "Method not allowed." });
    }

    const token = request.headers.get("Authorization")?.replace(
      /^Bearer\s+/i,
      "",
    );
    if (!token) return json(401, { error: "Authentication is required." });

    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return json(400, { error: "Invalid account details." });
    }

    const url = getEnv("SUPABASE_URL") ?? "";
    const publishableKey = getEnv("SUPABASE_PUBLISHABLE_KEY") ??
      getEnv("SUPABASE_ANON_KEY") ?? "";
    const secretKey = getEnv("SUPABASE_SECRET_KEY") ??
      getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const callerClient = createSupabaseClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await callerClient.auth
      .getUser(token);
    if (userError || !userData.user) {
      return json(401, { error: "Authentication is required." });
    }
    if (userData.user.id === parsed.data.userId) {
      return json(400, { error: "You cannot delete your own account." });
    }

    const { data: roleRow, error: roleError } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (roleError) {
      return json(500, { error: "Unable to verify administrator access." });
    }
    if (roleRow?.role !== "system_administrator") {
      return json(403, { error: "Administrator access is required." });
    }

    const adminClient = createSupabaseClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", parsed.data.userId)
      .maybeSingle();
    if (targetError) {
      return json(500, { error: "Unable to find this account." });
    }
    if (!targetProfile) return json(404, { error: "Account not found." });

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      parsed.data.userId,
    );
    if (deleteError) {
      return json(500, { error: "Unable to delete this account." });
    }

    const { error: auditError } = await adminClient.from("audit_logs").insert({
      actor_user_id: userData.user.id,
      entity_type: "profiles",
      entity_id: parsed.data.userId,
      action: "delete",
      metadata: {
        full_name: targetProfile.full_name,
        email: targetProfile.email,
      },
    });
    if (auditError) {
      return json(500, {
        error: "Account deleted, but the audit record could not be saved.",
      });
    }

    return new Response(null, { status: 204, headers: corsHeaders });
  };
}

if (import.meta.main) {
  Deno.serve(createDeleteManagedUserHandler());
}
