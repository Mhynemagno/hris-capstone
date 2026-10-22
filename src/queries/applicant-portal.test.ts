import { beforeEach, describe, expect, it, vi } from "vitest";

const applicantId = "323e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), remove: vi.fn(), storageFrom: vi.fn(), createClient: vi.fn(), resetPasswordForEmail: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => { mocks.createClient(...args); return { auth: { resetPasswordForEmail: mocks.resetPasswordForEmail } }; },
}));
vi.mock("@/lib/supabase/env", () => ({ getPublicSupabaseConfig: () => ({ url: "http://127.0.0.1:54321", publishableKey: "test-key" }) }));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: (bucket: string) => { mocks.storageFrom(bucket); return { remove: mocks.remove }; } },
  }),
}));

import { listHrRegisteredApplicants, listMyApplicationHistory, reactivateApplicantAccount, removeMyApplicantProfileDocument, reopenApplicationForResubmission, saveMyApplicantEducation, sendApplicantCredentials } from "./applicant-portal";

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

  const primary = { schoolName: "San Juan Elementary", degreeCourse: "Primary Education", yearGraduated: "2008", location: "San Juan City" };
  const secondary = { schoolName: "San Juan High", degreeCourse: "Junior High School", yearGraduated: "2012", location: "San Juan City" };
  const bachelors = { schoolName: "PUP", degreeCourse: "BS Criminology", yearGraduated: "2016", location: "Manila" };
  const blank = { schoolName: "", degreeCourse: "", yearGraduated: "", location: "" };

  it("inserts new levels, updates existing ones, and removes a cleared optional level", async () => {
    const writes = tableMock([{ id: "row-secondary", level: "secondary" }, { id: "row-graduate", level: "graduate" }]);
    await saveMyApplicantEducation(applicantId, { elementary: primary, secondary, college: bachelors, graduate: blank });
    expect(writes).toEqual([
      { op: "insert", payload: { applicant_id: applicantId, level: "elementary", school_name: "San Juan Elementary", degree_course: "Primary Education", year_graduated: 2008, location: "San Juan City" } },
      { op: "update", payload: { school_name: "San Juan High", degree_course: "Junior High School", year_graduated: 2012, location: "San Juan City" }, id: "row-secondary" },
      { op: "insert", payload: { applicant_id: applicantId, level: "college", school_name: "PUP", degree_course: "BS Criminology", year_graduated: 2016, location: "Manila" } },
      { op: "delete", id: "row-graduate" },
    ]);
  });

  it("saves an optional graduate degree when it is filled in completely", async () => {
    const writes = tableMock([]);
    await saveMyApplicantEducation(applicantId, { elementary: primary, secondary, college: bachelors, graduate: { schoolName: "UP Diliman", degreeCourse: "MA Public Administration", yearGraduated: "2020", location: "Quezon City" } });
    expect(writes.at(-1)).toEqual({ op: "insert", payload: { applicant_id: applicantId, level: "graduate", school_name: "UP Diliman", degree_course: "MA Public Administration", year_graduated: 2020, location: "Quezon City" } });
  });

  it("rejects a required level with a missing field before writing", async () => {
    const writes = tableMock([]);
    await expect(saveMyApplicantEducation(applicantId, { elementary: { ...primary, location: "" }, secondary, college: bachelors, graduate: blank })).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it("rejects an out-of-range graduation year before writing", async () => {
    const writes = tableMock([]);
    await expect(saveMyApplicantEducation(applicantId, { elementary: { ...primary, yearGraduated: "1850" }, secondary, college: bachelors, graduate: blank })).rejects.toThrow();
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

describe("HR applicant account help", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reactivates an applicant account through the HR RPC", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await reactivateApplicantAccount("u1");
    expect(mocks.rpc).toHaveBeenCalledWith("reactivate_applicant_account", { target_user_id: "u1" });
  });

  it("reopens a Not Selected application with a trimmed optional note", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await reopenApplicationForResubmission("app-1", "  Upload a clearer diploma.  ");
    expect(mocks.rpc).toHaveBeenCalledWith("reopen_application_for_resubmission", { target_application_id: "app-1", target_note: "Upload a clearer diploma." });
    await reopenApplicationForResubmission("app-1");
    expect(mocks.rpc).toHaveBeenLastCalledWith("reopen_application_for_resubmission", { target_application_id: "app-1", target_note: null });
  });

  it("emails new credentials as a password reset that opens the reset-password page, without persisting a session", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    await sendApplicantCredentials("ana@example.test");
    expect(mocks.createClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "test-key", expect.objectContaining({ auth: expect.objectContaining({ persistSession: false, flowType: "implicit" }) }));
    const [email, options] = mocks.resetPasswordForEmail.mock.calls[0]!;
    expect(email).toBe("ana@example.test");
    const redirect = new URL((options as { redirectTo: string }).redirectTo);
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/reset-password");
  });

  it("reports a failed credentials email", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: "rate limited" } });
    await expect(sendApplicantCredentials("ana@example.test")).rejects.toThrow("We could not send new credentials. Please try again.");
  });
});

describe("listMyApplicationHistory", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads the application's status history oldest first", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: "h1" }], error: null });
    const eq = vi.fn(() => ({ order }));
    mocks.from.mockReturnValue({ select: vi.fn(() => ({ eq })) });
    await expect(listMyApplicationHistory("223e4567-e89b-42d3-a456-426614174000")).resolves.toEqual([{ id: "h1" }]);
    expect(mocks.from).toHaveBeenCalledWith("application_status_history");
    expect(eq).toHaveBeenCalledWith("application_id", "223e4567-e89b-42d3-a456-426614174000");
    expect(order).toHaveBeenCalledWith("created_at");
  });
});
