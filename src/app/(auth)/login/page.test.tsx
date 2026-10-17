import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("@/lib/recruitment/recruitment-notice", () => ({ getRecruitmentNotice: async () => ({ title: "Patrolman / Patrolwoman (Cycle 2026)" }) }));

import LoginPage from "./page";

async function renderLogin(params: { as?: string; error?: string; message?: string; next?: string } = {}) {
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
    expect(screen.getByText("Access your PDS.")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "To Serve and Protect." })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login as Applicant" })).toHaveAttribute("href", "/login?as=applicant");
    expect(document.querySelector('input[name="as"]')).toHaveValue("employee");
  });

  it("directs applicants without an account to contact HR", async () => {
    await renderLogin({ as: "applicant" });
    expect(screen.getByRole("heading", { level: 1, name: "Login as Applicant" })).toBeVisible();
    expect(screen.getByText("Enter your registered email address below to access your application status and updates.")).toBeVisible();
    expect(screen.getByText(/Current Hiring Pool for/)).toHaveTextContent("Patrolman / Patrolwoman (Cycle 2026)");
    expect(screen.getByText("San Juan City PNP Online Recruitment & Applicant Portal System")).toBeVisible();
    expect(screen.getByText("Don't have an account? Contact HR.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login as Employee" })).toHaveAttribute("href", "/login?as=employee");
  });

  it("sends a visitor coming from a job to the applicant login with the apply return path", async () => {
    await expect(renderLogin({ next: "/applicant/applications?jobId=5" })).rejects.toThrow(`REDIRECT /login?as=applicant&next=${encodeURIComponent("/applicant/applications?jobId=5")}`);
  });

  it("keeps the apply return path on the applicant login", async () => {
    const next = "/applicant/applications?jobId=5";
    await renderLogin({ as: "applicant", next });
    expect(screen.getAllByText("Applicant Portal").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
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

  it("has no separate Admin & HR Login: ?as=admin opens the Employee / HR login, keeping the return path", async () => {
    await expect(renderLogin({ as: "admin", next: "/admin" })).rejects.toThrow("REDIRECT /login?as=employee&next=%2Fadmin");
  });

  it("sends visitors bound for /hr or /admin to the Employee / HR login", async () => {
    await expect(renderLogin({ next: "/hr/jobs" })).rejects.toThrow("REDIRECT /login?as=employee&next=%2Fhr%2Fjobs");
    await expect(renderLogin({ next: "/admin" })).rejects.toThrow("REDIRECT /login?as=employee&next=%2Fadmin");
  });

  it("offers employees, HR and SysAd email or badge sign-in without an Access Level", async () => {
    await renderLogin({ as: "employee", next: "/hr" });
    expect(screen.getByLabelText("Email Address or Badge Number")).toBeVisible();
    expect(screen.getByText("Access your PDS.")).toBeVisible();
    expect(screen.queryByLabelText("Access Level")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin & HR Login" })).not.toBeInTheDocument();
    expect(document.querySelector('input[name="next"]')).toHaveValue("/hr");
  });
});
