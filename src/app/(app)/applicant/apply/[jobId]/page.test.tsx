import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_REDIRECT"); }));
vi.mock("next/navigation", () => ({ redirect, notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import ApplicantApplyPage from "./page";

describe("old Apply links", () => {
  it("open the Documents page, which remembers the posting", async () => {
    await expect(ApplicantApplyPage({ params: Promise.resolve({ jobId: "12" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/applicant/documents?apply=12");
  });

  it("treat a malformed id as not found", async () => {
    await expect(ApplicantApplyPage({ params: Promise.resolve({ jobId: "abc" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
