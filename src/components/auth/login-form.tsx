"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { loginSchema } from "@/schemas/auth";

type LoginFormProps = { nextPath?: string };

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Enter valid sign-in details.");
    setPending(true);
    const { error: authError } = await createBrowserSupabaseClient().auth.signInWithPassword(result.data);
    setPending(false);
    if (authError) return setError("We could not sign you in. Check your details and try again.");
    const next = getSafeNextPath(nextPath);
    router.replace(`/auth/continue?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  return <form className="space-y-4" onSubmit={onSubmit} noValidate>
    <FormField htmlFor="login-email" label="Email"><input className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 shadow-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20" id="login-email" name="email" type="email" /></FormField>
    <FormField htmlFor="login-password" label="Password"><input className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 shadow-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20" id="login-password" name="password" type="password" /></FormField>
    {error ? <ErrorState message={error} /> : null}
    <button className="w-full rounded-md bg-sky-400 px-4 py-2 font-medium text-slate-950 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}
