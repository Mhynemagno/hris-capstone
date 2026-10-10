import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoginPage from "./page";

async function renderLogin(params: { as?: string; error?: string; message?: string; next?: string } = {}) {
  render(await LoginPage({ searchParams: Promise.resolve(params) }));
}

describe("LoginPage", () => {
  it("shows the HRIS login and a sign-up link for a plain visit", async () => {
    await renderLogin();
    expect(screen.getByRole("heading", { level: 1, name: "Login" })).toBeVisible();
    expect(screen.getByText("San Juan City Police HRIS")).toBeVisible();
    expect(screen.getByRole("button", { name: "Login" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/applicant/register");
  });

  it("hides sign-up on the employee login, since administrators create employee accounts", async () => {
    await renderLogin({ as: "employee" });
    expect(screen.getByRole("heading", { level: 1, name: "Employee login" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login as Applicant" })).toHaveAttribute("href", "/login?as=applicant");
    expect(document.querySelector('input[name="as"]')).toHaveValue("employee");
  });

  it("offers sign-up on the applicant login", async () => {
    await renderLogin({ as: "applicant" });
    expect(screen.getByRole("heading", { level: 1, name: "Applicant login" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/applicant/register");
    expect(screen.getByRole("link", { name: "Login as Employee" })).toHaveAttribute("href", "/login?as=employee");
  });

  it("treats a visitor coming from a job as an applicant and keeps the apply return path", async () => {
    const next = "/applicant/applications?jobId=9";
    await renderLogin({ next });
    expect(screen.getByRole("heading", { level: 1, name: "Applicant login" })).toBeVisible();
    expect(screen.getByText("PNP San Juan Recruitment")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", `/applicant/register?next=${encodeURIComponent(next)}`);
    expect(document.querySelector('input[name="next"]')).toHaveValue(next);
  });

  it("explains a disabled account", async () => {
    await renderLogin({ error: "account_disabled" });
    expect(screen.getByText(/This account can no longer sign in/)).toBeVisible();
  });
  it("confirms a verified email instead of showing an error", async () => {
    await renderLogin({ message: "email_confirmed" });
    expect(screen.getByRole("status")).toHaveTextContent("Email confirmed. Please log in.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
