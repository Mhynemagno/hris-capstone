import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (tokenHash && type === "invite") {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });

    return NextResponse.redirect(
      new URL(error ? "/login?error=invitation_expired" : "/reset-password", request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  return NextResponse.redirect(
    new URL(error ? "/login?error=invitation_expired" : nextPath, request.url),
  );
}
