"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { DUPLICATE_EMAIL_MESSAGE, isDuplicateEmailError, isObfuscatedExistingUser } from "@/lib/auth/duplicate-email";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { APPLICANT_QUALIFIERS, applicantRegistrationSchema } from "@/schemas/auth";

type RegistrationField = "email" | "mobileNumber" | "lastName" | "firstName" | "middleName" | "qualifier" | "birthdate" | "password" | "confirmPassword";
type RegistrationErrors = Partial<Record<RegistrationField, string>>;

const inputClassName =
  "h-11 w-full rounded-md border bg-white px-3 text-slate-950 outline-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 aria-invalid:border-destructive";

/** Confirmation links return through the callback, which knows a sign-up link may be opened in another browser. */
function confirmationRedirect(nextPath: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", nextPath);
  callback.searchParams.set("flow", "signup");
  return callback.toString();
}

function PasswordField({ autoComplete, error, id, label, name }: { autoComplete: string; error?: string; id: string; label: string; name: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField error={error} htmlFor={id} label={label} required>
      <div className="relative">
        <input aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error ? true : undefined} autoComplete={autoComplete} className={`${inputClassName} pr-12`} id={id} minLength={6} name={name} required type={visible ? "text" : "password"} />
        <button aria-controls={id} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} className="absolute inset-y-0 right-0 flex size-11 items-center justify-center rounded-r-md text-slate-500 outline-none hover:text-slate-950 focus-visible:ring-3 focus-visible:ring-primary/20" onClick={() => setVisible((current) => !current)} type="button">
          {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      </div>
    </FormField>
  );
}

/** `nextPath` is an already-validated /applicant or /jobs destination to continue to after registering. */
export function ApplicantRegistrationForm({ loginHref = "/login", nextPath = null }: { loginHref?: string; nextPath?: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({});
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [pending, setPending] = useState(false);

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
            middle_name: result.data.middleName,
            qualifier: result.data.qualifier,
            phone: result.data.mobileNumber,
            date_of_birth: result.data.birthdate,
            full_name: result.data.fullName,
          },
          emailRedirectTo: confirmationRedirect(nextPath ?? "/jobs"),
        },
      });
      if (authError) {
        if (isDuplicateEmailError(authError)) setFieldErrors({ email: DUPLICATE_EMAIL_MESSAGE });
        else setError("We could not create your account. Please try again.");
        return;
      }
      if (isObfuscatedExistingUser(data.user)) {
        setFieldErrors({ email: DUPLICATE_EMAIL_MESSAGE });
        return;
      }
      if (!data.session) {
        setConfirmationPending(true);
        return;
      }
      router.replace(nextPath ?? "/jobs");
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (confirmationPending) {
    return (
      <div aria-live="polite" className="space-y-3 rounded-lg border border-primary/25 bg-accent p-4 text-foreground" role="status">
        <p className="font-semibold">Check your email</p>
        <p className="text-sm text-slate-700">We created your account. Open the confirmation link we sent before signing in.</p>
        <a className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4" href={loginHref}>
          Return to sign in
        </a>
      </div>
    );
  }

  return (
    <form aria-busy={pending} className="space-y-4" noValidate onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField error={fieldErrors.lastName} htmlFor="registration-last-name" label="Last Name" required><input autoComplete="family-name" className={inputClassName} id="registration-last-name" maxLength={60} name="lastName" required /></FormField>
        <FormField error={fieldErrors.firstName} htmlFor="registration-first-name" label="First Name" required><input autoComplete="given-name" className={inputClassName} id="registration-first-name" maxLength={60} name="firstName" required /></FormField>
        <FormField error={fieldErrors.middleName} htmlFor="registration-middle-name" label="Middle Name"><input autoComplete="additional-name" className={inputClassName} id="registration-middle-name" maxLength={60} name="middleName" /></FormField>
        <FormField error={fieldErrors.qualifier} htmlFor="registration-qualifier" label="Qualifier" required><select className={inputClassName} defaultValue="" id="registration-qualifier" name="qualifier" required><option disabled value="">Select</option>{APPLICANT_QUALIFIERS.map((qualifier) => <option key={qualifier} value={qualifier}>{qualifier}</option>)}<option value="None">None</option></select></FormField>
        <FormField error={fieldErrors.email} htmlFor="registration-email" label="Email" required><input autoComplete="email" className={inputClassName} id="registration-email" inputMode="email" name="email" required type="email" /></FormField>
        <FormField error={fieldErrors.mobileNumber} htmlFor="registration-mobile" label="Mobile Number" required><input autoComplete="tel" className={inputClassName} id="registration-mobile" inputMode="tel" maxLength={16} name="mobileNumber" placeholder="+639XXXXXXXXX" required type="tel" /></FormField>
        <FormField error={fieldErrors.birthdate} htmlFor="registration-birthdate" label="Birthdate" required>
          <input autoComplete="bday" className={inputClassName} id="registration-birthdate" name="birthdate" required type="date" />
        </FormField>
        <PasswordField autoComplete="new-password" error={fieldErrors.password} id="registration-password" label="Password" name="password" />
        <PasswordField autoComplete="new-password" error={fieldErrors.confirmPassword} id="registration-confirm-password" label="Confirm Password" name="confirmPassword" />
      </div>
      {error ? <ErrorState message={error} /> : null}
      <button className="h-11 w-full rounded-md bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Registering…" : "Register"}
      </button>
    </form>
  );
}
