import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { SESSION_ONLY_COOKIE } from "@/lib/supabase/remember-me";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { internalLoginSchema, loginIdentifierSchema } from "@/schemas/auth";

function loginRedirect(request: NextRequest, nextPath: string, error?: string, mode?: string) {
  const url = new URL("/login", request.url);
  if (mode) url.searchParams.set("as", mode);
  if (nextPath !== "/") url.searchParams.set("next", nextPath);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const nextValue = formData.get("next");
  const nextPath = getSafeNextPath(
    typeof nextValue === "string" ? nextValue : undefined,
  );
  const asValue = formData.get("as");
  const mode = asValue === "employee" || asValue === "applicant" ? asValue : undefined;
  const credentials = { identifier: formData.get("identifier"), password: formData.get("password") };
  const result = mode === "applicant"
    ? loginIdentifierSchema("applicant").safeParse(credentials)
    : mode === "employee"
      ? loginIdentifierSchema("employee").safeParse(credentials)
      : internalLoginSchema.safeParse({ identifier: formData.get("identifier") ?? formData.get("email"), password: formData.get("password") });

  if (!result.success) {
    return loginRedirect(request, nextPath, "invalid_credentials", mode);
  }

  // Applicants type their email; a badge or applicant number is looked up server-side.
  const identifier = result.data.identifier;
  let email = typeof identifier === "object"
    ? (identifier.kind === "email" ? identifier.value : null)
    : (mode ? null : (z.email().safeParse(identifier).success ? identifier : null));
  if (!email) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const { url } = getPublicSupabaseConfig();
      const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const lookup = typeof identifier === "object" ? identifier.value : identifier;
      const { data } = await admin.rpc("resolve_login_identifier", { target_mode: mode ?? "employee", target_identifier: lookup });
      email = typeof data === "string" ? data : null;
    }
    if (!email) return loginRedirect(request, nextPath, "invalid_credentials", mode);
  }

  // Record "Remember me" before Supabase writes its session cookies, so they are written as session
  // cookies when it is unticked. Employees have no such box: their sessions stay persistent.
  const cookieStore = await cookies();
  if (mode === "applicant" && formData.get("remember") !== "on") cookieStore.set(SESSION_ONLY_COOKIE, "1", { path: "/", sameSite: "lax" });
  else cookieStore.delete(SESSION_ONLY_COOKIE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: result.data.password });

  if (error) {
    // Supabase Auth refuses accounts an administrator has blocked from signing in.
    const code = (error as { code?: string }).code;
    return loginRedirect(request, nextPath, code === "user_banned" ? "account_disabled" : "invalid_credentials", mode);
  }

  // Belt and braces for "Account can sign in" being cleared: refuse the session here too.
  if (data?.user) {
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
    if (profile?.is_active === false) {
      await supabase.auth.signOut();
      return loginRedirect(request, nextPath, "account_disabled", mode);
    }
  }

  const continueUrl = new URL("/auth/continue", request.url);
  continueUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(continueUrl, 303);
}
