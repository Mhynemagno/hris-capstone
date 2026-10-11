import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("@/lib/recruitment/recruitment-notice", () => ({ getRecruitmentNotice: async () => ({ title: "Patrolman / Patrolwoman (Cycle 2026)" }) }));

import LoginPage from "./page";

async function renderLogin(params: { as?: string; error?: string; level?: string; message?: string; next?: string } = {}) {
  render(await LoginPage({ searchParams: Promise.resolve(params) }));
}

describe("LoginPage", () => {
  it("no longer has a generic login: a plain visit opens the employee login", async () => {
    await expect(renderLogin()).rejects.toThrow("REDIRECT /login?as=employee");
  });

  it("keeps the return path and messages when choosing the login for the visitor", async () => {
    await expect(renderLogin({ error: "account_disabled", next: "/employee" })).rejects.toThrow("REDIRECT /login?as=employee&next=%2Femployee&error=account_disabled");
    await expect(renderLogin({ message: "email_confirmed" })).rejects.toThrow("REDIRECT /login?as=applicant&message=email_confirmed");
  });

  it("uses the Capstone employee portal treatment while keeping badge-number sign-in", async () => {
    await renderLogin({ as: "employee" });
    expect(screen.getAllByText("Employee Portal").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1, name: "Employee / HR" })).toBeVisible();
    expect(screen.getByText(/Enter your badge number to access your official personnel records/)).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "To Serve and Protect." })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login as Applicant" })).toHaveAttribute("href", "/login?as=applicant");
    expect(document.querySelector('input[name="as"]')).toHaveValue("employee");
  });

  it("offers sign-up on the applicant login", async () => {
    await renderLogin({ as: "applicant" });
    expect(screen.getByRole("heading", { level: 1, name: "Login as Applicant" })).toBeVisible();
    expect(screen.getByText("Enter your registered email address below to access your application status and updates.")).toBeVisible();
    expect(screen.getByText(/Current Hiring Pool for/)).toHaveTextContent("Patrolman / Patrolwoman (Cycle 2026)");
    expect(screen.getByText("San Juan City PNP Online Recruitment & Applicant Portal System")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/applicant/register");
    expect(screen.getByRole("link", { name: "Login as Employee" })).toHaveAttribute("href", "/login?as=employee");
  });

  it("sends a visitor coming from a job to the applicant login with the apply return path", async () => {
    await expect(renderLogin({ next: "/applicant/applications?jobId=5" })).rejects.toThrow(`REDIRECT /login?as=applicant&next=${encodeURIComponent("/applicant/applications?jobId=5")}`);
  });

  it("keeps the apply return path on the applicant login", async () => {
    const next = "/applicant/applications?jobId=5";
    await renderLogin({ as: "applicant", next });
    expect(screen.getAllByText("Applicant Portal").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", `/applicant/register?next=${encodeURIComponent(next)}`);
    expect(document.querySelector('input[name="next"]')).toHaveValue(next);
  });

  it("explains a disabled account", async () => {
    await renderLogin({ as: "employee", error: "account_disabled" });
    expect(screen.getByText(/This account can no longer sign in/)).toBeVisible();
  });
  it("says the email may already be confirmed when a confirmation link was used", async () => {
    await renderLogin({ as: "applicant", message: "email_confirmed_or_used" });
    expect(screen.getByRole("status")).toHaveTextContent("Your email may already be confirmed. Try logging in.");
  });

  it("confirms a verified email instead of showing an error", async () => {
    await renderLogin({ as: "applicant", message: "email_confirmed" });
    expect(screen.getByRole("status")).toHaveTextContent("Email confirmed. Please log in.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the Admin & HR Login (sample.html)", async () => {
    await renderLogin({ as: "admin" });
    expect(screen.getByText("Administrative Access")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Admin & HR Login" })).toBeInTheDocument();
    expect(screen.getByText("Authorized management portal for HR Personnel Officers and System Administrators.")).toBeInTheDocument();
    expect(screen.getByLabelText("Access Level")).toHaveValue("hr");
    expect(screen.getByRole("option", { name: "System Administrator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address or Badge Number")).toHaveAttribute("type", "text");
    expect(screen.getByText("System Management & Administration")).toBeInTheDocument();
    expect(screen.getByText("Management Portal")).toBeInTheDocument();
    expect(screen.queryByText(/Current Hiring Pool for/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login as Employee" })).toHaveAttribute("href", "/login?as=employee");
    expect(document.querySelector('input[name="as"]')).toHaveValue("admin");
  });

  it("explains an Access Level mismatch and keeps the chosen level", async () => {
    await renderLogin({ as: "admin", error: "wrong_access_level", level: "sysad" });
    expect(screen.getByRole("alert")).toHaveTextContent("This account does not have System Administrator access.");
    expect(screen.getByLabelText("Access Level")).toHaveValue("sysad");
  });

  it("sends visitors bound for /hr or /admin to the admin login", async () => {
    await expect(renderLogin({ next: "/hr/jobs" })).rejects.toThrow("REDIRECT /login?as=admin&next=%2Fhr%2Fjobs");
    await expect(renderLogin({ next: "/admin" })).rejects.toThrow("REDIRECT /login?as=admin&next=%2Fadmin");
  });

  it("links the employee login to the admin login", async () => {
    await renderLogin({ as: "employee" });
    expect(screen.getByRole("link", { name: "Admin & HR Login" })).toHaveAttribute("href", "/login?as=admin");
  });
});
