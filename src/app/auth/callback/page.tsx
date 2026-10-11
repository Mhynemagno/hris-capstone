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

/**
 * Email scanners often open a one-time confirmation link before the applicant does. Supabase then
 * confirms the address but reports the applicant's own click as expired, so sign-up link errors say
 * the email may already be confirmed instead of calling the link invalid.
 */
const SIGNUP_LINK_USED = "/login?as=applicant&message=email_confirmed_or_used";
const INVITATION_EXPIRED = "/login?as=employee&error=invitation_expired";

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const signupFlow = searchParams.get("flow") === "signup" || type === "signup";
  const requestedNext = searchParams.get("next");
  // A confirmed applicant lands in the portal; the posting they chose was remembered at registration.
  const destination = requestedNext ? getSafeNextPath(requestedNext) : signupFlow ? "/applicant" : "/";
  const queryError = searchParams.get("error_code") ?? searchParams.get("error");

  useEffect(() => {
    let active = true;

    async function complete() {
      // Supabase sends error / error_code back when the link itself was expired or already used,
      // in the query string or (implicit flow) in the URL hash.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const linkError = queryError ?? hash.get("error_code") ?? hash.get("error");
      if (linkError) {
        if (active) router.replace(signupFlow ? SIGNUP_LINK_USED : INVITATION_EXPIRED);
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
      if (!error) router.replace(destination);
      else router.replace(signupFlow ? SIGNUP_LINK_USED : INVITATION_EXPIRED);
    }

    void complete();
    return () => { active = false; };
  }, [code, destination, queryError, router, signupFlow, tokenHash, type]);

  return <p aria-live="polite">Completing sign-in…</p>;
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<p aria-live="polite">Completing sign-in…</p>}><AuthCallback /></Suspense>;
}
