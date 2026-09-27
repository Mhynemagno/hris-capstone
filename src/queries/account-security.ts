import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/** Changes the signed-in user's password, then leaves a "Password changed" notice in their notifications. */
export async function changeMyPassword(password: string) {
  const client = createBrowserSupabaseClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  // The password is already changed at this point, so a failed notice must not report the change as failed.
  await Promise.resolve(client.rpc("record_password_changed")).catch(() => undefined);
}
