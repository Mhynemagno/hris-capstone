"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextPath = getSafeNextPath(searchParams.get("next"));

  useEffect(() => {
    let active = true;

    async function complete() {
      const supabase = createBrowserSupabaseClient();
      let error: Error | null = null;

      if (tokenHash && type === "invite") {
        ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" }));
      } else if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else {
        const result = await supabase.auth.getSession();
        error = result.error ?? (result.data.session ? null : new Error("Invitation session is missing."));
      }

      if (active) router.replace(error ? "/login?error=invitation_expired" : nextPath);
    }

    void complete();
    return () => { active = false; };
  }, [code, nextPath, router, tokenHash, type]);

  return <p aria-live="polite">Completing sign-in…</p>;
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<p aria-live="polite">Completing sign-in…</p>}><AuthCallback /></Suspense>;
}
