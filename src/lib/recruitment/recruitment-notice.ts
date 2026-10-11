import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RecruitmentNotice = { title: string } | null;

/** The newest open posting, shown as the applicant login's Recruitment Notice. A failed lookup shows no notice. */
export async function getRecruitmentNotice(): Promise<RecruitmentNotice> {
  const supabase = await createServerSupabaseClient();
  // A posting is open through its closing date in Philippine time, like the database's current_date checks.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
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
