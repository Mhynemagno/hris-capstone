p = "src/queries/recruitment.ts"
s = open(p, encoding="utf-8").read()
start = s.index("export async function listHrApplications(")
end = s.index("\n}\n", start) + 3
new = '''type ShortlistFilters = { status?: Application["status"]; aiStatus?: HrShortlistApplication["ai_score_status"]; minimumScore?: number };

async function fetchShortlist(filters: ShortlistFilters, from: number, to: number) {
  const { data, error } = await createBrowserSupabaseClient()
    .rpc("list_hr_application_shortlist", { target_application_status: filters.status ?? null, target_ai_status: filters.aiStatus ?? null, minimum_score: filters.minimumScore ?? null })
    .range(from, to);
  throwIfError(error);
  const shortlist = (data ?? []) as { application_id: string; applicant_id: string; job_opening_id: number; application_status: Application["status"]; submitted_at: string; ai_score_id: string | null; ai_score_status: HrShortlistApplication["ai_score_status"] | null; ai_score: number | null; ai_explanation: string | null; ai_model: string | null }[];
  // The shortlist RPC returns ids only; HR can read applicants and openings, so name them in two batched reads.
  const { applicants, jobs } = await shortlistNames(shortlist.map((row) => row.applicant_id), shortlist.map((row) => row.job_opening_id));
  return shortlist.map((row) => {
    const applicant = applicants.get(row.applicant_id);
    return {
      id: row.application_id, applicant_id: row.applicant_id, job_opening_id: row.job_opening_id, status: row.application_status, submitted_at: row.submitted_at,
      ai_score_id: row.ai_score_id, ai_score_status: row.ai_score_status ?? "unscored", ai_score: row.ai_score, ai_explanation: row.ai_explanation, ai_model: row.ai_model,
      applicant_name: applicant ? [applicant.first_name, applicant.last_name].filter(Boolean).join(" ") || null : null,
      applicant_number: applicant?.applicant_number ?? null,
      job_title: jobs.get(row.job_opening_id) ?? null,
    };
  }) as HrShortlistApplication[];
}

export async function listHrApplications(input: Partial<ApplicationAiFilters> = {}) {
  const filters = applicationAiFiltersSchema.parse(input);
  const { from, to } = pageRange(filters.page, filters.pageSize);
  const rows = await fetchShortlist(filters, from, to);
  return { rows, count: rows.length, filters } satisfies PaginatedResult<HrShortlistApplication, ApplicationAiFilters>;
}

/** Every application for the HR list, which filters, sorts and pages on the client. Move to server paging if volumes grow past ~1000. */
export async function listAllHrApplications(filters: Omit<ShortlistFilters, "status"> = {}) {
  return fetchShortlist(filters, 0, 999);
}
'''
s = s[:start] + new + s[end:]
open(p, "w", encoding="utf-8").write(s)

p = "src/hooks/use-recruitment.ts"
s = open(p, encoding="utf-8").read()
s = s.replace("  listHrApplications,\n", "  listHrApplications,\n  listAllHrApplications,\n", 1)
s = s.replace('import type { JobPostingImageChange, ResubmitApplicationInput } from "@/queries/recruitment";', 'import type { JobPostingImageChange, ResubmitApplicationInput } from "@/queries/recruitment";\nimport type { HrShortlistApplication } from "@/lib/types/database";', 1)
s += '''
export function useAllHrApplications(filters: { aiStatus?: HrShortlistApplication["ai_score_status"]; minimumScore?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.recruitment.applications({ all: true, ...filters }),
    queryFn: () => listAllHrApplications(filters),
    refetchInterval: (query) => analysisRefetchInterval((query.state.data ?? []).map((row) => row.ai_score_status)),
  });
}
'''
open(p, "w", encoding="utf-8").write(s)
print("ok")
