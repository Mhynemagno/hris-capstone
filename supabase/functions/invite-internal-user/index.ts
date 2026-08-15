import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";

const inputSchema = z.object({
  email: z.email(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  role: z.enum(["system_administrator", "hr_personnel", "employee", "management"]),
});

const json = (status: number, body: Record<string, string>) =>
  Response.json(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Authentication is required." });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Invalid invitation details." });
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "Authentication is required." });
  const { data: roleRow } = await callerClient.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
  if (roleRow?.role !== "system_administrator") return json(403, { error: "Administrator access is required." });
  const adminClient = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`;
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      full_name: fullName,
    },
    redirectTo: `${new URL(request.url).origin}/auth/callback`,
  });
  if (inviteError || !invited.user) return json(409, { error: "Unable to invite this account." });
  const { error: roleError } = await callerClient.rpc("update_managed_user", {
    target_user_id: invited.user.id,
    next_role: parsed.data.role,
    next_is_active: true,
  });
  if (roleError) { await adminClient.auth.admin.deleteUser(invited.user.id); return json(500, { error: "Unable to assign the account role." }); }
  return json(201, { userId: invited.user.id });
});
