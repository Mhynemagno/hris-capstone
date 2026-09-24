"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";

import { PasswordInput } from "./password-input";

type LoginFormProps = {
  error?: string;
  nextPath: string;
};

export function LoginForm({ error, nextPath }: LoginFormProps) {
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
      <FormField htmlFor="login-email" label="Email">
        <input
          autoComplete="username"
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 shadow-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
          id="login-email"
          inputMode="email"
          name="email"
          type="email"
        />
      </FormField>
      <FormField htmlFor="login-password" label="Password">
        <PasswordInput />
      </FormField>
      {error ? <ErrorState message={error} /> : null}
      <button
        className="min-h-11 w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
