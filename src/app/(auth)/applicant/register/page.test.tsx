import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ auth: { signUp: vi.fn() } }) }));
vi.mock("@/lib/recruitment/recruitment-notice", () => ({ getRecruitmentNotice: async () => null }));

import ApplicantRegistrationPage from "./page";

async function renderRegister(params: { next?: string } = {}) {
  render(await ApplicantRegistrationPage({ searchParams: Promise.resolve(params) }));
}

describe("ApplicantRegistrationPage", () => {
  it("uses the applicant portal frame", async () => {
    await renderRegister();
    expect(screen.getByRole("heading", { level: 1, name: "Create Applicant Account" })).toBeVisible();
    expect(screen.getByText("There is no active recruitment at the moment. Please check back for new openings.")).toBeInTheDocument();
  });

  it("shows a centered Login link back to sign-in", async () => {
    await renderRegister();
    const link = screen.getByRole("link", { name: "Login" });
    expect(link).toHaveAttribute("href", "/login?as=applicant");
    expect(link.parentElement).toHaveTextContent("Already have an account? Login");
    expect(link.parentElement).toHaveClass("text-center");
  });

  it("keeps a safe recruitment next path on the Login link", async () => {
    const next = "/applicant/applications?jobId=5";
    await renderRegister({ next });
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", `/login?as=applicant&next=${encodeURIComponent(next)}`);
  });

  it("drops unsafe next paths", async () => {
    await renderRegister({ next: "https://evil.example/applicant" });
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login?as=applicant");
  });
});
