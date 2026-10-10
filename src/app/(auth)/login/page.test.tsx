import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));

import LoginPage from "./page";

async function renderLogin(params: { as?: string; error?: string; message?: string; next?: string } = {}) {
  render(await LoginPage({ searchParams: Promise.resolve(params) }));
}

describe("LoginPage", () => {
  it("no longer has a generic login: a plain visit opens the employee login", async () => {
    await expect(renderLogin()).rejects.toThrow("REDIRECT /login?as=employee");
  });

  it("keeps the return path and messages when choosing the login for the visitor", async () => {
    await expect(renderLogin({ error: "account_disabled", next: "/hr" })).rejects.toThrow("REDIRECT /login?as=employee&next=%2Fhr&error=account_disabled");
    await expect(renderLogin({ message: "email_confirmed" })).rejects.toThrow("REDIRECT /login?as=applicant&message=email_confirmed");
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

  it("sends a visitor coming from a job to the applicant login with the apply return path", async () => {
    await expect(renderLogin({ next: "/applicant/applications?jobId=5" })).rejects.toThrow(`REDIRECT /login?as=applicant&next=${encodeURIComponent("/applicant/applications?jobId=5")}`);
  });

  it("keeps the apply return path on the applicant login", async () => {
    const next = "/applicant/applications?jobId=5";
    await renderLogin({ as: "applicant", next });
    expect(screen.getByText("PNP San Juan Recruitment")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", `/applicant/register?next=${encodeURIComponent(next)}`);
    expect(document.querySelector('input[name="next"]')).toHaveValue(next);
  });

  it("explains a disabled account", async () => {
    await renderLogin({ as: "employee", error: "account_disabled" });
    expect(screen.getByText(/This account can no longer sign in/)).toBeVisible();
  });
  it("confirms a verified email instead of showing an error", async () => {
    await renderLogin({ as: "applicant", message: "email_confirmed" });
    expect(screen.getByRole("status")).toHaveTextContent("Email confirmed. Please log in.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
