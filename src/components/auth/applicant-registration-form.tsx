"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { applicantRegistrationSchema } from "@/schemas/auth";

export function ApplicantRegistrationForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = applicantRegistrationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Enter valid registration details.");
    setPending(true);
    const { data, error: authError } = await createBrowserSupabaseClient().auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        data: {
          first_name: result.data.firstName,
          last_name: result.data.lastName,
          full_name: result.data.fullName,
        },
      },
    });
    setPending(false);
    if (authError) return setError("We could not create your account. Please try again.");
    if (!data.session) return setConfirmationPending(true);
    router.replace("/applicant");
    router.refresh();
  }

  if (confirmationPending) {
    return <div aria-live="polite" className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-slate-900" role="status"><p className="font-semibold">Check your email</p><p className="text-sm text-slate-700">We created your account. Open the confirmation link we sent before signing in.</p><a className="inline-flex min-h-11 items-center font-medium text-sky-800 underline underline-offset-4" href="/login">Return to sign in</a></div>;
  }

  return <form className="space-y-4" onSubmit={onSubmit} noValidate><div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="registration-first-name" label="First name"><input autoComplete="given-name" className="h-11 w-full rounded-md border bg-white px-3 text-slate-950" id="registration-first-name" name="firstName" /></FormField><FormField htmlFor="registration-last-name" label="Last name"><input autoComplete="family-name" className="h-11 w-full rounded-md border bg-white px-3 text-slate-950" id="registration-last-name" name="lastName" /></FormField></div><FormField htmlFor="registration-email" label="Email"><input autoComplete="email" className="h-11 w-full rounded-md border bg-white px-3 text-slate-950" id="registration-email" name="email" type="email" /></FormField><FormField htmlFor="registration-password" label="Password"><input autoComplete="new-password" className="h-11 w-full rounded-md border bg-white px-3 text-slate-950" id="registration-password" name="password" type="password" /></FormField>{error ? <ErrorState message={error} /> : null}<button className="h-11 w-full rounded-md bg-sky-400 px-4 font-medium text-slate-950 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Creating account…" : "Create account"}</button></form>;
}
