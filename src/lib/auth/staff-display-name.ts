import { createServerSupabaseClient } from "@/lib/supabase/server";

import { formatStaffDisplayName } from "./staff-display-name-format";

/** The signed-in staff member's header name, from their linked personnel record. */
export async function getStaffDisplayName(userId: string, fallback: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("employees").select("first_name, middle_name, last_name, ranks(code)").eq("profile_id", userId).maybeSingle();
  if (!data) return fallback;
  const rank = (Array.isArray(data.ranks) ? data.ranks[0] : data.ranks) as { code: string } | null | undefined;
  return formatStaffDisplayName({ rankCode: rank?.code ?? null, firstName: data.first_name, middleName: data.middle_name, lastName: data.last_name }, fallback);
}
