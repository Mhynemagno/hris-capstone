import { describe, expect, it } from "vitest";

import { getRecruitmentNextPath } from "./recruitment-next-path";

describe("getRecruitmentNextPath", () => {
  it("keeps relative applicant and job paths with their query", () => {
    expect(getRecruitmentNextPath("/applicant/applications?jobId=5")).toBe("/applicant/applications?jobId=5");
    expect(getRecruitmentNextPath("/jobs/12")).toBe("/jobs/12");
    expect(getRecruitmentNextPath("/applicant")).toBe("/applicant");
  });

  it("rejects external, non-recruitment, and register destinations", () => {
    for (const value of [undefined, null, "", "https://evil.example/applicant", "//evil.example/jobs", "/hr", "/admin/users", "/applicantx", "/jobsite", "/applicant/register", "/applicant/register?next=/jobs"]) {
      expect(getRecruitmentNextPath(value)).toBeNull();
    }
  });
});
