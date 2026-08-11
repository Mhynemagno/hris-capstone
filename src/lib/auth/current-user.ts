import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  email: string | null;
  id: string;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;

  if (error || typeof subject !== "string") {
    return null;
  }

  return {
    id: subject,
    email: typeof claims?.email === "string" ? claims.email : null,
  };
}

export async function getVerifiedUserId(): Promise<string | null> {
  return (await getAuthenticatedUser())?.id ?? null;
}
