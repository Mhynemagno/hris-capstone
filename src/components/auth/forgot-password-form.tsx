"use client";

import { useState, type FormEvent } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { forgotPasswordSchema } from "@/schemas/auth";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const result = forgotPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Enter a valid email address.");
    setPending(true);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/reset-password");
    const { error: authError } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(result.data.email, { redirectTo: callback.toString() });
    setPending(false);
    if (authError) return setError("We could not send a reset link. Please try again.");
    setSent(true);
  }
  if (sent) return <p aria-live="polite" className="text-sm text-slate-200">Check your email for a password-reset link.</p>;
  return <form className="space-y-4" onSubmit={onSubmit} noValidate><FormField htmlFor="recovery-email" label="Email"><input className="w-full rounded-md border bg-white px-3 py-2 text-slate-950" id="recovery-email" name="email" type="email" /></FormField>{error ? <ErrorState message={error} /> : null}<button className="w-full rounded-md bg-sky-400 px-4 py-2 font-medium text-slate-950 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Sending…" : "Send reset link"}</button></form>;
}
