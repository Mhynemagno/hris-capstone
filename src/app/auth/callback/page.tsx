"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];

function isOtpType(value: string | null): value is OtpType {
  return OTP_TYPES.includes(value as OtpType);
}

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Supabase sends error / error_code back when the link itself was expired or already used.
  const linkError = searchParams.get("error_code") ?? searchParams.get("error");
  const signupFlow = searchParams.get("flow") === "signup";
  const nextPath = getSafeNextPath(searchParams.get("next"));

  useEffect(() => {
    let active = true;

    async function complete() {
      if (linkError) {
        if (active) router.replace("/login?error=invitation_expired");
        return;
      }
      const supabase = createBrowserSupabaseClient();
      let error: Error | null = null;

      if (tokenHash && isOtpType(type)) {
        ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
      } else if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else {
        const result = await supabase.auth.getSession();
        error = result.error ?? (result.data.session ? null : new Error("Invitation session is missing."));
      }

      // A link that was already used may still have left this browser signed in.
      if (error && (code || tokenHash)) {
        const { data } = await supabase.auth.getSession();
        if (data.session) error = null;
      }

      if (!active) return;
      if (!error) router.replace(nextPath);
      // Supabase only redirects with a code after it confirmed the email, so a sign-up code that cannot be
      // exchanged here (opened in another browser) still means the account is confirmed.
      else router.replace(signupFlow && code ? "/login?message=email_confirmed" : "/login?error=invitation_expired");
    }

    void complete();
    return () => { active = false; };
  }, [code, linkError, nextPath, router, signupFlow, tokenHash, type]);

  return <p aria-live="polite">Completing sign-in…</p>;
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<p aria-live="polite">Completing sign-in…</p>}><AuthCallback /></Suspense>;
}
