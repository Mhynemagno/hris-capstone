"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/schemas/auth";

export function ResetPasswordForm() {
  const router = useRouter(); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); const result = resetPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget))); if (!result.success) return setError(result.error.issues[0]?.message ?? "Enter a valid password."); setPending(true); const { error: authError } = await createBrowserSupabaseClient().auth.updateUser({ password: result.data.password }); setPending(false); if (authError) return setError("We could not update your password. Please request a new link."); router.replace("/"); router.refresh(); }
  return <form className="space-y-4" onSubmit={onSubmit} noValidate><FormField htmlFor="new-password" label="New password"><input className="w-full rounded-md border bg-white px-3 py-2 text-slate-950" id="new-password" name="password" type="password" /></FormField><FormField htmlFor="confirm-password" label="Confirm password"><input className="w-full rounded-md border bg-white px-3 py-2 text-slate-950" id="confirm-password" name="passwordConfirmation" type="password" /></FormField>{error ? <ErrorState message={error} /> : null}<button className="w-full rounded-md bg-sky-400 px-4 py-2 font-medium text-slate-950 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Update password"}</button></form>;
}
