import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=invitation_expired", request.url));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  return NextResponse.redirect(
    new URL(error ? "/login?error=invitation_expired" : nextPath, request.url),
  );
}
