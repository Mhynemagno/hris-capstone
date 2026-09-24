"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { applicantRegistrationSchema } from "@/schemas/auth";

type RegistrationField = "firstName" | "lastName" | "email" | "password";
type RegistrationErrors = Partial<Record<RegistrationField, string>>;

const inputClassName =
  "h-11 w-full rounded-md border bg-white px-3 text-slate-950 outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 aria-invalid:border-destructive";

export function ApplicantRegistrationForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({});
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [pending, setPending] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = applicantRegistrationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!result.success) {
      const next: RegistrationErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as RegistrationField;
        if (key && !next[key]) next[key] = key === "email" ? "Enter a valid email address." : issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
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
      if (authError) {
        setError("We could not create your account. Please try again.");
        return;
      }
      if (!data.session) {
        setConfirmationPending(true);
        return;
      }
      router.replace("/applicant");
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (confirmationPending) {
    return (
      <div aria-live="polite" className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-slate-900" role="status">
        <p className="font-semibold">Check your email</p>
        <p className="text-sm text-slate-700">We created your account. Open the confirmation link we sent before signing in.</p>
        <a className="inline-flex min-h-11 items-center font-medium text-sky-800 underline underline-offset-4" href="/login">
          Return to sign in
        </a>
      </div>
    );
  }

  return (
    <form aria-busy={pending} className="space-y-4" noValidate onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField error={fieldErrors.firstName} htmlFor="registration-first-name" label="First name">
          <input autoComplete="given-name" className={inputClassName} id="registration-first-name" maxLength={60} name="firstName" required />
        </FormField>
        <FormField error={fieldErrors.lastName} htmlFor="registration-last-name" label="Last name">
          <input autoComplete="family-name" className={inputClassName} id="registration-last-name" maxLength={60} name="lastName" required />
        </FormField>
      </div>
      <FormField error={fieldErrors.email} htmlFor="registration-email" label="Email">
        <input autoComplete="email" className={inputClassName} id="registration-email" inputMode="email" name="email" required type="email" />
      </FormField>
      <FormField description="At least 6 characters." error={fieldErrors.password} htmlFor="registration-password" label="Password">
        <input
          autoComplete="new-password"
          className={inputClassName}
          id="registration-password"
          minLength={6}
          name="password"
          required
          type={passwordVisible ? "text" : "password"}
        />
      </FormField>
      <button
        aria-controls="registration-password"
        aria-pressed={passwordVisible}
        className="-mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-sky-800 underline-offset-4 hover:underline"
        onClick={() => setPasswordVisible((visible) => !visible)}
        type="button"
      >
        {passwordVisible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        {passwordVisible ? "Hide password" : "Show password"}
      </button>
      {error ? <ErrorState message={error} /> : null}
      <button className="h-11 w-full rounded-md bg-sky-400 px-4 font-medium text-slate-950 disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
