import { describe, expect, it } from "vitest";

import type { HrRegisteredApplicant, HrShortlistApplication } from "@/lib/types/database";

import { buildApplicationRows, parseApplicationListParams } from "./application-list";

const app = (overrides: Partial<HrShortlistApplication>): HrShortlistApplication => ({
  id: "11111111-aaaa-bbbb-cccc-000000000001", applicant_id: "a1", job_opening_id: 1, status: "Application Submission", cover_note: null, submitted_at: "2026-10-01T00:00:00Z",
  reviewed_at: null, hired_employee_id: null, created_at: "", updated_at: "", ai_score_id: null, ai_score_status: "completed", ai_score: 80, ai_explanation: null, ai_model: null,
  applicant_name: "Ana Reyes", applicant_number: 12345, job_title: "Patrol North", ...overrides,
});
const registered = (overrides: Partial<HrRegisteredApplicant>): HrRegisteredApplicant => ({
  user_id: "u9", applicant_id: null, applicant_number: null, first_name: "Ben", middle_name: null, last_name: "Cruz", qualifier: null, full_name: null, email: "ben@example.test", phone: null,
  registered_at: "2026-10-02T00:00:00Z", email_confirmed: true, application_count: 0, latest_application_id: null, latest_application_status: null, latest_job_title: null, latest_submitted_at: null, ...overrides,
});

describe("application list", () => {
  it("parses URL params and drops junk", () => {
    expect(parseApplicationListParams({ quick: "bogus", stage: "Bogus", job: "abc", q: " ana ", ai: "weird", minScore: "abc", sort: "nope", page: "x" })).toEqual({
      quick: "active", stage: "", job: null, q: "ana", ai: "", minScore: undefined, sort: { key: "ai", direction: "desc" }, page: 1,
    });
    expect(parseApplicationListParams({ quick: "hired", stage: "Panel Interview", job: "3", q: "", ai: "failed", minScore: "150", sort: "name:asc", page: "2" })).toMatchObject({
      quick: "hired", stage: "Panel Interview", job: 3, ai: "failed", minScore: 100, sort: { key: "name", direction: "asc" }, page: 2,
    });
  });

  it("shows active applications by default and keeps not-yet-applied people one click away", () => {
    const apps = [app({ id: "1", status: "Panel Interview" }), app({ id: "2", status: "Hired" }), app({ id: "3", status: "Not Selected" })];
    const people = [registered({})];
    const base = parseApplicationListParams({});
    expect(buildApplicationRows(apps, people, base).map((row) => row.id)).toEqual(["1"]);
    expect(buildApplicationRows(apps, people, { ...base, quick: "hired" }).map((row) => row.id)).toEqual(["2"]);
    expect(buildApplicationRows(apps, people, { ...base, quick: "not-yet-applied" }).map((row) => row.kind)).toEqual(["registered"]);
    expect(buildApplicationRows(apps, people, { ...base, quick: "all" })).toHaveLength(4);
  });

  it("lets an explicit stage or job override the quick view and never matches registered rows", () => {
    const apps = [app({ id: "1", status: "Hired", job_opening_id: 2 }), app({ id: "2", status: "Panel Interview", job_opening_id: 1 })];
    const base = parseApplicationListParams({});
    expect(buildApplicationRows(apps, [registered({})], { ...base, stage: "Hired" }).map((row) => row.id)).toEqual(["1"]);
    expect(buildApplicationRows(apps, [registered({})], { ...base, job: 1 }).map((row) => row.id)).toEqual(["2"]);
  });

  it("searches names and applicant numbers, and survives missing lookups", () => {
    const apps = [app({ id: "1", applicant_name: null, applicant_number: null, job_title: null }), app({ id: "2", applicant_name: "Ana Reyes" })];
    const base = { ...parseApplicationListParams({}), quick: "all" as const };
    expect(buildApplicationRows(apps, [], { ...base, q: "reyes" }).map((row) => row.id)).toEqual(["2"]);
    expect(buildApplicationRows(apps, [], { ...base, q: "0-12345" }).map((row) => row.id)).toEqual(["2"]);
    const fallback = buildApplicationRows(apps, [], base).find((row) => row.id === "1")!;
    expect(fallback.name).toBe("Application 1");
    expect(fallback.kind === "application" && fallback.jobTitle).toBeNull();
  });
});
