import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getVerifiedUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  if (error || typeof subject !== "string") {
    return null;
  }

  return subject;
}
