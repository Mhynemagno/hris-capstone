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
