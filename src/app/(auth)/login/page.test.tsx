import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoginPage from "./page";

async function renderLogin(params: { error?: string; next?: string } = {}) {
  render(await LoginPage({ searchParams: Promise.resolve(params) }));
}

describe("LoginPage", () => {
  it("shows the HRIS title and a sign-up link for a plain visit", async () => {
    await renderLogin();
    expect(screen.getByRole("heading", { level: 1, name: "San Juan City Police HRIS" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Login" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/applicant/register");
  });

  it("shows the recruitment title and keeps the apply return path when coming from a job", async () => {
    const next = "/applicant/applications?jobId=9";
    await renderLogin({ next });
    expect(screen.getByRole("heading", { level: 1, name: "PNP San Juan Recruitment" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", `/applicant/register?next=${encodeURIComponent(next)}`);
    expect(document.querySelector('input[name="next"]')).toHaveValue(next);
  });

  it("explains a disabled account", async () => {
    await renderLogin({ error: "account_disabled" });
    expect(screen.getByText(/This account can no longer sign in/)).toBeVisible();
  });
});
