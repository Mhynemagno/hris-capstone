"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";

import { PasswordInput } from "./password-input";

type LoginFormProps = {
  error?: string;
  /** Which login the visitor chose; kept so a failed attempt returns to the same page. */
  mode?: "employee" | "applicant" | null;
  nextPath: string;
};

export function LoginForm({ error, mode, nextPath }: LoginFormProps) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Returning via the back button can restore this page from the bfcache with the pending state still set.
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form
      action="/auth/login"
      aria-busy={pending}
      className="space-y-4"
      method="post"
      noValidate
      // Do not preventDefault: the native POST to /auth/login sets the session cookies and redirects.
      onSubmit={() => setPending(true)}
    >
      <input name="next" type="hidden" value={nextPath} />
      {mode ? <input name="as" type="hidden" value={mode} /> : null}
      <FormField htmlFor="login-identifier" label={mode === "applicant" ? "Applicant Number" : mode === "employee" ? "Badge Number" : "Email"}>
        <input
          autoComplete="username"
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 shadow-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
          id="login-identifier"
          inputMode={mode === "applicant" ? "numeric" : mode === "employee" ? "text" : "email"}
          name={mode ? "identifier" : "email"}
          pattern={mode === "applicant" ? "[0-9]*" : undefined}
          type={mode === "applicant" ? "text" : mode === "employee" ? "text" : "email"}
        />
      </FormField>
      <div className="space-y-2">
        <FormField htmlFor="login-password" label="Password">
          <PasswordInput />
        </FormField>
        <div className="text-right text-sm"><Link className="font-medium text-primary underline-offset-4 hover:underline" href="/forgot-password">Forgot your password?</Link></div>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <button
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in…" : <>Login<ArrowRight aria-hidden="true" className="size-4" /></>}
      </button>
    </form>
  );
}
