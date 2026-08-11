import { appRoleSchema } from "@/schemas/common";
import type { AppRole } from "@/lib/types/roles";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { getVerifiedUserId } from "./current-user";

export async function getCurrentRole(): Promise<AppRole | null> {
  const userId = await getVerifiedUserId();

  if (!userId) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return appRoleSchema.safeParse(data.role).data ?? null;
}
