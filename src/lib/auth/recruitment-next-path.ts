import { getSafeNextPath } from "@/lib/auth/safe-redirect";

const recruitmentRoots = ["/applicant", "/jobs"] as const;

/** A `next` destination an applicant may continue to after registering: a relative /applicant or /jobs path, never the register page itself. */
export function getRecruitmentNextPath(value: string | null | undefined): string | null {
  const candidate = getSafeNextPath(value, "");
  if (!candidate) return null;
  const pathname = new URL(candidate, "http://hris.local").pathname;
  if (pathname === "/applicant/register" || pathname.startsWith("/applicant/register/")) return null;
  return recruitmentRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`)) ? candidate : null;
}

/**
 * The posting a visitor was applying for when sent to register: "/applicant/apply/12", "/jobs/12" or an
 * old "/applicant/applications?jobId=12" link → 12. Registration remembers it for the Documents-page Save.
 */
export function preferredJobIdFromNext(next: string | null | undefined): number | null {
  if (!next) return null;
  const url = new URL(next, "http://hris.local");
  const fromPath = /^\/(?:applicant\/apply|jobs)\/(\d{1,12})\/?$/.exec(url.pathname)?.[1];
  const fromQuery = url.pathname === "/applicant/applications" ? url.searchParams.get("jobId") : null;
  const id = Number(fromPath ?? fromQuery);
  return Number.isInteger(id) && id > 0 ? id : null;
}
