import type { Page } from "@playwright/test";

/**
 * Employees sign in with their badge number; applicants, HR and System Administrators with their email
 * address (HR and SysAd at the Admin & HR Login, choosing their Access Level).
 * These are the fictitious accounts from supabase/seed.sql.
 */
export type LoginAccount = { mode: "employee" | "applicant" | "admin"; identifier: string; accessLevel?: "hr" | "sysad" };

const DEMO_ACCOUNTS: Record<string, LoginAccount> = {
  "demo.admin@example.test": { mode: "admin", identifier: "demo.admin@example.test", accessLevel: "sysad" },
  "demo.hr@example.test": { mode: "admin", identifier: "demo.hr@example.test", accessLevel: "hr" },
  "demo.management@example.test": { mode: "employee", identifier: "0-00003" },
  "demo.employee@example.test": { mode: "employee", identifier: "0-00001" },
  "demo.applicant@example.test": { mode: "applicant", identifier: "demo.applicant@example.test" },
};

export function loginAccountFor(account: string | LoginAccount): LoginAccount {
  if (typeof account !== "string") return account;
  const demo = DEMO_ACCOUNTS[account];
  if (!demo) throw new Error(`No badge or applicant number is known for ${account}.`);
  return demo;
}

/** Fills the login form already on screen (the employee or applicant login) for the account. */
export async function fillLogin(page: Page, account: string | LoginAccount, password: string) {
  const { mode, identifier, accessLevel } = loginAccountFor(account);
  if (mode === "admin") await page.getByLabel("Access Level").selectOption(accessLevel ?? "hr");
  await page.getByLabel(mode === "employee" ? "Badge Number" : "Email Address").fill(identifier);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

/** Opens the right login page for the account and signs in. */
export async function openLoginAndSignIn(page: Page, account: string | LoginAccount, password: string) {
  await page.goto(`/login?as=${loginAccountFor(account).mode}`);
  await fillLogin(page, account, password);
}

/** Signs out from any shell: the Capstone UI shells use the account menu's Logout, the workspace shell its sidebar Sign out. */
export async function signOutFromShell(page: Page) {
  const signOut = page.getByRole("button", { name: "Sign out" });
  if (await signOut.isVisible()) {
    await signOut.click();
  } else {
    await page.getByRole("button", { name: /^Account menu for / }).click();
    await page.getByRole("menuitem", { name: "Logout" }).click();
  }
}
