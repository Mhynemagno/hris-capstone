import { describe, expect, it } from "vitest";

import { getRecruitmentNextPath, preferredJobIdFromNext } from "./recruitment-next-path";

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

describe("preferredJobIdFromNext", () => {
  it("reads the posting id from an apply destination", () => {
    expect(preferredJobIdFromNext("/applicant/apply/12")).toBe(12);
    expect(preferredJobIdFromNext("/jobs/7")).toBe(7);
    expect(preferredJobIdFromNext("/applicant/applications?jobId=5")).toBe(5);
    expect(preferredJobIdFromNext("/applicant")).toBeNull();
    expect(preferredJobIdFromNext("/jobs")).toBeNull();
    expect(preferredJobIdFromNext(null)).toBeNull();
  });
});
