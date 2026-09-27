import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ auth: { signUp: vi.fn() } }) }));

import ApplicantRegistrationPage from "./page";

async function renderRegister(params: { next?: string } = {}) {
  render(await ApplicantRegistrationPage({ searchParams: Promise.resolve(params) }));
}

describe("ApplicantRegistrationPage", () => {
  it("shows a centered Login link back to sign-in", async () => {
    await renderRegister();
    const link = screen.getByRole("link", { name: "Login" });
    expect(link).toHaveAttribute("href", "/login");
    expect(link.parentElement).toHaveTextContent("Already have an account? Login");
    expect(link.parentElement).toHaveClass("text-center");
  });

  it("keeps a safe recruitment next path on the Login link", async () => {
    const next = "/applicant/applications?jobId=5";
    await renderRegister({ next });
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(next)}`);
  });

  it("drops unsafe next paths", async () => {
    await renderRegister({ next: "https://evil.example/applicant" });
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
  });
});
