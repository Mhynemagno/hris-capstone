"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChangePasswordFormProps = {
  onChangePassword: (password: string) => void | Promise<void>;
};

export function ChangePasswordForm({ onChangePassword }: ChangePasswordFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form now: React clears `event.currentTarget` once the handler awaits.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    setError(null);
    setSaved(false);
    if (password.length < 8) return setError("Use at least 8 characters for your new password.");
    if (password !== confirmation) return setError("New password and confirmation must match.");
    setPending(true);
    try {
      await onChangePassword(password);
      formElement.reset();
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not change your password.");
    } finally {
      setPending(false);
    }
  }

  return <form className="space-y-4" noValidate onSubmit={submit}>
    <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="new-password">New password</label><Input autoComplete="new-password" id="new-password" minLength={8} name="password" required type="password" /></div>
    <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="confirm-new-password">Confirm new password</label><Input autoComplete="new-password" id="confirm-new-password" minLength={8} name="confirmation" required type="password" /></div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {saved ? <p className="text-sm text-green-700" role="status">Password updated. Use your new password the next time you sign in.</p> : null}
    <Button className="min-h-11" disabled={pending} type="submit">{pending ? "Changing password…" : "Change password"}</Button>
  </form>;
}
