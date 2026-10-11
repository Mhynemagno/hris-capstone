import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_REDIRECT"); }));
vi.mock("next/navigation", () => ({ redirect }));

import ApplicantApplicationDetailPage from "./page";

describe("old application detail links", () => {
  it("open the single Application Status page", async () => {
    await expect(ApplicantApplicationDetailPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/applicant/applications");
  });
});
