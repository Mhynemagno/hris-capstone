import { describe, expect, it } from "vitest";

import { deadlineNote, filterJobs, jobActions, jobStatusCounts, type HrJobLike } from "./job-postings";

const job = (overrides: Partial<HrJobLike>): HrJobLike => ({ id: 1, title: "Patrol 2026", location: "San Juan", status: "published", closes_on: "2026-10-20", updated_at: "2026-10-01T00:00:00Z", applications: [{ count: 0 }], ...overrides });
const today = new Date("2026-10-08T03:00:00Z");

describe("job postings", () => {
  it("allows deleting only empty drafts and withdrawing anything else still open", () => {
    expect(jobActions(job({ status: "draft" }))).toEqual({ canDelete: true, canWithdraw: false });
    expect(jobActions(job({ status: "draft", applications: [{ count: 2 }] }))).toEqual({ canDelete: false, canWithdraw: true });
    expect(jobActions(job({ status: "published" }))).toEqual({ canDelete: false, canWithdraw: true });
    expect(jobActions(job({ status: "closed" }))).toEqual({ canDelete: false, canWithdraw: false });
  });

  it("describes the deadline relative to today", () => {
    expect(deadlineNote("2026-10-13", "published", today)).toBe("Closes in 5 days");
    expect(deadlineNote("2026-10-09", "published", today)).toBe("Closes in 1 day");
    expect(deadlineNote("2026-10-08", "published", today)).toBe("Closes today");
    expect(deadlineNote("2026-10-01", "published", today)).toBe("Deadline passed");
    expect(deadlineNote("2026-10-20", "closed", today)).toBe("Closed");
    expect(deadlineNote(null, "draft", today)).toBeNull();
  });

  it("counts days in the Philippine calendar", () => {
    // 00:30 on October 8 in Manila; a posting closing October 8 closes today, not tomorrow.
    expect(deadlineNote("2026-10-08", "published", new Date("2026-10-07T16:30:00Z"))).toBe("Closes today");
  });

  it("filters by status tab and title search, and counts each tab", () => {
    const jobs = [job({ id: 1, title: "Patrol North" }), job({ id: 2, title: "Patrol South", status: "draft" }), job({ id: 3, title: "Intel", status: "closed" })];
    expect(filterJobs(jobs, { status: "draft", q: "" }).map((j) => j.id)).toEqual([2]);
    expect(filterJobs(jobs, { status: "", q: "patrol" }).map((j) => j.id)).toEqual([1, 2]);
    expect(filterJobs(jobs, { status: "bogus", q: "" })).toHaveLength(3);
    expect(jobStatusCounts(jobs)).toEqual({ all: 3, published: 1, draft: 1, closed: 1 });
  });
});
