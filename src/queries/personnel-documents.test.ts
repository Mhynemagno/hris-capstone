import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), remove: vi.fn(), signed: vi.fn(), bucket: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: mocks.from,
    storage: { from: (bucket: string) => { mocks.bucket(bucket); return { upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.signed }; } },
  }),
}));

import { removePersonnelDocument, replacePersonnelDocument, savePersonnelEntry, validatePersonnelDocument } from "./personnel-records";

const employeeId = "00000000-0000-4000-8000-000000000010";
const input = { employeeId, name: "Civil Service Professional Examination", awardedOn: "2015-12-10" };

function mockInsert(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const insert = vi.fn((values: Record<string, unknown>) => ({ values, select: () => ({ single }) }));
  mocks.from.mockReturnValue({ insert, update: vi.fn() });
  return insert;
}

describe("eligibility supporting documents", () => {
  beforeEach(() => { mocks.from.mockReset(); mocks.upload.mockReset(); mocks.remove.mockReset(); mocks.bucket.mockReset(); });

  it("uploads the document under the employee and saves it with the eligibility", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    const insert = mockInsert({ data: { id: "q1" }, error: null });
    const file = new File(["%PDF"], "CSC rating.pdf", { type: "application/pdf" });
    await savePersonnelEntry("qualification", input, undefined, file);
    expect(mocks.bucket).toHaveBeenCalledWith("personnel-documents");
    const path = mocks.upload.mock.calls[0]![0] as string;
    expect(path).toMatch(new RegExp(`^qualifications/${employeeId}/[0-9a-f-]{36}\.pdf$`));
    expect(insert.mock.calls[0]![0]).toMatchObject({ document_path: path, document_name: "CSC rating.pdf", document_mime_type: "application/pdf", document_size_bytes: 4 });
  });

  it("removes the uploaded document when the eligibility cannot be saved", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mockInsert({ data: null, error: { message: "Permission denied" } });
    const file = new File(["%PDF"], "csc.pdf", { type: "application/pdf" });
    await expect(savePersonnelEntry("qualification", input, undefined, file)).rejects.toThrow("Permission denied");
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]![0]]);
  });

  it("keeps the saved document when an update has no new file", async () => {
    const update = vi.fn((values: Record<string, unknown>) => ({ values, eq: () => ({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: "q1" }, error: null }) }) }) }));
    mocks.from.mockReturnValue({ update });
    await savePersonnelEntry("qualification", input, "q1");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(update.mock.calls[0]![0]).not.toHaveProperty("document_path");
  });
});

function mockUpdate(result: { data: unknown; error: unknown }) {
  const update = vi.fn((values: Record<string, unknown>) => ({
    values,
    eq: () => Object.assign(Promise.resolve({ error: result.error }), { select: () => ({ single: vi.fn().mockResolvedValue(result) }) }),
  }));
  mocks.from.mockReturnValue({ update });
  return update;
}

const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });

describe("certification / training documents (PDF p. 23)", () => {
  beforeEach(() => { mocks.from.mockReset(); mocks.upload.mockReset().mockResolvedValue({ error: null }); mocks.remove.mockReset().mockResolvedValue({ error: null }); mocks.bucket.mockReset(); });

  it("uploads a certification document under certifications/<employee>/", async () => {
    const insert = mockInsert({ data: { id: "c1" }, error: null });
    await savePersonnelEntry("certification", { employeeId, name: "Public Safety Basic Recruit Course (PSBRC)", issuedOn: "2016-03-14" }, undefined, pdf("psbrc.pdf"));
    const path = mocks.upload.mock.calls[0]![0] as string;
    expect(path).toMatch(new RegExp(`^certifications/${employeeId}/[0-9a-f-]{36}\.pdf$`));
    expect(insert.mock.calls[0]![0]).toMatchObject({ document_path: path, document_name: "psbrc.pdf" });
  });

  it("replaces a document: upload the new one, update the row, then remove the old object", async () => {
    const update = mockUpdate({ data: { id: "c1" }, error: null });
    await replacePersonnelDocument("certification", { id: "c1", employee_id: employeeId, document_path: `certifications/${employeeId}/old.pdf` }, pdf("new.pdf"));
    expect(update.mock.calls[0]![0]).toMatchObject({ document_name: "new.pdf", document_mime_type: "application/pdf", document_size_bytes: 4 });
    expect(mocks.remove).toHaveBeenLastCalledWith([`certifications/${employeeId}/old.pdf`]);
  });

  it("keeps the old document and removes the new upload when the row update fails", async () => {
    mockUpdate({ data: null, error: { message: "denied" } });
    await expect(replacePersonnelDocument("qualification", { id: "q1", employee_id: employeeId, document_path: `qualifications/${employeeId}/old.pdf` }, pdf("new.pdf"))).rejects.toThrow("denied");
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]![0]]);
    expect(mocks.remove).not.toHaveBeenCalledWith([`qualifications/${employeeId}/old.pdf`]);
  });

  it("removes a document: clear the row, then the object", async () => {
    const update = mockUpdate({ data: null, error: null });
    await removePersonnelDocument("qualification", { id: "q1", document_path: `qualifications/${employeeId}/old.pdf` });
    expect(update.mock.calls[0]![0]).toEqual({ document_path: null, document_name: null, document_mime_type: null, document_size_bytes: null });
    expect(mocks.remove).toHaveBeenCalledWith([`qualifications/${employeeId}/old.pdf`]);
  });

  it("rejects the wrong file type before uploading", () => {
    expect(validatePersonnelDocument(new File(["x"], "clip.mp4", { type: "video/mp4" }))).toBe("Use a PDF, JPEG, PNG or WEBP file up to 10 MB.");
    expect(validatePersonnelDocument(pdf("ok.pdf"))).toBeNull();
  });
});
