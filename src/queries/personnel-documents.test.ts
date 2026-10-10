import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), remove: vi.fn(), signed: vi.fn(), bucket: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: mocks.from,
    storage: { from: (bucket: string) => { mocks.bucket(bucket); return { upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.signed }; } },
  }),
}));

import { savePersonnelEntry } from "./personnel-records";

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
