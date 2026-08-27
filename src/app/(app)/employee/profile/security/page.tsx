"use client";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function EmployeeSecurityPage() {
  return <section className="mx-auto max-w-xl space-y-2"><h1 className="text-2xl font-semibold tracking-tight">Account security</h1><p className="text-sm text-muted-foreground">Choose a new password for your account.</p><div className="mt-6 rounded-2xl border bg-card p-5"><ChangePasswordForm onChangePassword={async (password) => { const { error } = await createBrowserSupabaseClient().auth.updateUser({ password }); if (error) throw new Error(error.message); }} /></div></section>;
}
