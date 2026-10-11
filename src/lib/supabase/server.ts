import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicSupabaseConfig } from "./env";
import { applyRememberMe, readSessionOnly } from "./remember-me";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getPublicSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          const sessionOnly = readSessionOnly(cookieStore);
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, applyRememberMe(options, sessionOnly)),
          );
        } catch {
          // Server Components cannot write cookies; middleware refreshes sessions.
        }
      },
    },
  });
}
