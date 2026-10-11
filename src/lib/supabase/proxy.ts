import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicSupabaseConfig } from "./env";
import { applyRememberMe, readSessionOnly } from "./remember-me";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getPublicSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        const sessionOnly = readSessionOnly(request.cookies);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, applyRememberMe(options, sessionOnly)),
        );
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  return {
    response,
    userId: error || typeof subject !== "string" ? null : subject,
  };
}
