import { beforeEach, describe, expect, it, vi } from "vitest";

const applicantId = "323e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), remove: vi.fn(), storageFrom: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: (bucket: string) => { mocks.storageFrom(bucket); return { remove: mocks.remove }; } },
  }),
}));

import { listHrRegisteredApplicants, removeMyApplicantProfileDocument, saveMyApplicantEducation } from "./applicant-portal";

function tableMock(existing: { id: string; level: string }[]) {
  const writes: { op: string; payload?: unknown; id?: unknown }[] = [];
  mocks.from.mockImplementation(() => ({
    select: () => ({ eq: vi.fn().mockResolvedValue({ data: existing, error: null }) }),
    insert: (payload: unknown) => { writes.push({ op: "insert", payload }); return Promise.resolve({ error: null }); },
    update: (payload: unknown) => ({ eq: (_column: string, id: unknown) => { writes.push({ op: "update", payload, id }); return Promise.resolve({ error: null }); } }),
    delete: () => ({ eq: (_column: string, id: unknown) => { writes.push({ op: "delete", id }); return Promise.resolve({ error: null }); } }),
  }));
  return writes;
}

describe("saveMyApplicantEducation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("inserts new levels, updates existing ones, and removes cleared ones", async () => {
    const writes = tableMock([{ id: "row-secondary", level: "secondary" }, { id: "row-college", level: "college" }]);
    await saveMyApplicantEducation(applicantId, {
      elementary: { schoolName: "San Juan Elementary", degreeCourse: "", yearGraduated: "2008" },
      secondary: { schoolName: "San Juan High", degreeCourse: "", yearGraduated: "" },
      college: { schoolName: "", degreeCourse: "", yearGraduated: "" },
    });
    expect(writes).toEqual([
      { op: "insert", payload: { applicant_id: applicantId, level: "elementary", school_name: "San Juan Elementary", degree_course: null, year_graduated: 2008 } },
      { op: "update", payload: { school_name: "San Juan High", degree_course: null, year_graduated: null }, id: "row-secondary" },
      { op: "delete", id: "row-college" },
    ]);
  });

  it("rejects an out-of-range graduation year before writing", async () => {
    const writes = tableMock([]);
    await expect(saveMyApplicantEducation(applicantId, { elementary: { yearGraduated: "1850" }, secondary: {}, college: {} })).rejects.toThrow();
    expect(writes).toEqual([]);
  });
});

describe("removeMyApplicantProfileDocument", () => {
  beforeEach(() => vi.resetAllMocks());

  it("removes the metadata through the RPC and then deletes the stored object", async () => {
    mocks.rpc.mockResolvedValue({ data: "applicant-profiles/u/doc.pdf", error: null });
    mocks.remove.mockResolvedValue({ error: null });
    await expect(removeMyApplicantProfileDocument("diploma")).resolves.toEqual({ cleanupError: null });
    expect(mocks.rpc).toHaveBeenCalledWith("remove_my_applicant_profile_document", { target_kind: "diploma" });
    expect(mocks.storageFrom).toHaveBeenCalledWith("applicant-profile-documents");
    expect(mocks.remove).toHaveBeenCalledWith(["applicant-profiles/u/doc.pdf"]);
  });

  it("surfaces a refusal and keeps the stored object", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "This document is under review for an application in progress." } });
    await expect(removeMyApplicantProfileDocument("eligibility")).rejects.toThrow("under review");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

describe("listHrRegisteredApplicants", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads the HR applicant directory RPC and normalizes counts", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ user_id: "u1", application_count: "0", latest_application_status: null }], error: null });
    await expect(listHrRegisteredApplicants()).resolves.toEqual([{ user_id: "u1", application_count: 0, latest_application_status: null }]);
    expect(mocks.rpc).toHaveBeenCalledWith("list_hr_registered_applicants");
  });
});
