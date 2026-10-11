import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RecruitmentNotice = { title: string } | null;

/** The newest open posting, shown as the applicant login's Recruitment Notice. A failed lookup shows no notice. */
export async function getRecruitmentNotice(): Promise<RecruitmentNotice> {
  const supabase = await createServerSupabaseClient();
  // Same day boundary as the database's open check (private.posting_is_open uses current_date, which is UTC),
  // so the notice never says a posting is closed while Save All Documents still submits to it.
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("job_openings")
    .select("title")
    .eq("status", "published")
    .or(`closes_on.is.null,closes_on.gte.${today}`)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.title) return null;
  return { title: data.title };
}
