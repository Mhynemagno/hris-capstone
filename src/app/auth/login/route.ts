import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginSchema } from "@/schemas/auth";

function loginRedirect(request: NextRequest, nextPath: string, error?: string) {
  const url = new URL("/login", request.url);
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
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return loginRedirect(request, nextPath, "invalid_credentials");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    // Supabase Auth refuses accounts an administrator has blocked from signing in.
    const code = (error as { code?: string }).code;
    return loginRedirect(request, nextPath, code === "user_banned" ? "account_disabled" : "invalid_credentials");
  }

  // Belt and braces for "Account can sign in" being cleared: refuse the session here too.
  if (data?.user) {
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
    if (profile?.is_active === false) {
      await supabase.auth.signOut();
      return loginRedirect(request, nextPath, "account_disabled");
    }
  }

  const continueUrl = new URL("/auth/continue", request.url);
  continueUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(continueUrl, 303);
}
