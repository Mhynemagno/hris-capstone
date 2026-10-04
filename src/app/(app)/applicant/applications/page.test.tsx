import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/recruitment/applicant-application-status", () => ({ ApplicantApplicationStatus: () => null }));

import ApplicantApplicationsPage from "./page";

describe("ApplicantApplicationsPage", () => {
  it("sends old ?jobId links to the one-page apply flow", async () => {
    await expect(ApplicantApplicationsPage({ searchParams: Promise.resolve({ jobId: "5" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/applicant/apply/5");
  });

  it("shows the status list without a jobId", async () => {
    mocks.redirect.mockClear();
    await expect(ApplicantApplicationsPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
