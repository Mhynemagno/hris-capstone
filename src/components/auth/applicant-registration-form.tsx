"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { applicantRegistrationSchema } from "@/schemas/auth";

export function ApplicantRegistrationForm() {
  const router = useRouter(); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false); const [confirmation, setConfirmation] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); const result = applicantRegistrationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Enter valid registration details.");
    setPending(true); const callback = new URL("/auth/callback", window.location.origin);
    const { data, error: authError } = await createBrowserSupabaseClient().auth.signUp({ email: result.data.email, password: result.data.password, options: { data: { first_name: result.data.firstName, last_name: result.data.lastName, full_name: result.data.fullName }, emailRedirectTo: callback.toString() } });
    setPending(false); if (authError) return setError("We could not create your account. Please try again.");
    if (!data.session) return setConfirmation(true); router.replace("/"); router.refresh();
  }
  if (confirmation) return <p aria-live="polite" className="text-sm text-slate-200">Check your email to confirm your account.</p>;
  return <form className="space-y-4" onSubmit={onSubmit} noValidate><div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="registration-first-name" label="First name"><input autoComplete="given-name" className="h-11 w-full rounded-md border bg-white px-3 text-slate-950" id="registration-first-name" name="firstName" /></FormField><FormField htmlFor="registration-last-name" label="Last name"><input autoComplete="family-name" className="h-11 w-full rounded-md border bg-white px-3 text-slate-950" id="registration-last-name" name="lastName" /></FormField></div><FormField htmlFor="registration-email" label="Email"><input autoComplete="email" className="h-11 w-full rounded-md border bg-white px-3 text-slate-950" id="registration-email" name="email" type="email" /></FormField><FormField htmlFor="registration-password" label="Password"><input autoComplete="new-password" className="h-11 w-full rounded-md border bg-white px-3 text-slate-950" id="registration-password" name="password" type="password" /></FormField>{error ? <ErrorState message={error} /> : null}<button className="h-11 w-full rounded-md bg-sky-400 px-4 font-medium text-slate-950 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Creating account…" : "Create account"}</button></form>;
}
