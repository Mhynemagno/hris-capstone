import type { Page } from "@playwright/test";

/**
 * There is no email login: staff sign in with their badge number and applicants with their applicant number.
 * These are the fictitious accounts from supabase/seed.sql.
 */
export type LoginAccount = { mode: "employee" | "applicant"; identifier: string };

const DEMO_ACCOUNTS: Record<string, LoginAccount> = {
  "demo.admin@example.test": { mode: "employee", identifier: "0-00004" },
  "demo.hr@example.test": { mode: "employee", identifier: "0-00002" },
  "demo.management@example.test": { mode: "employee", identifier: "0-00003" },
  "demo.employee@example.test": { mode: "employee", identifier: "0-00001" },
  "demo.applicant@example.test": { mode: "applicant", identifier: "202604" },
};

export function loginAccountFor(account: string | LoginAccount): LoginAccount {
  if (typeof account !== "string") return account;
  const demo = DEMO_ACCOUNTS[account];
  if (!demo) throw new Error(`No badge or applicant number is known for ${account}.`);
  return demo;
}

/** Fills the login form already on screen (the employee or applicant login) for the account. */
export async function fillLogin(page: Page, account: string | LoginAccount, password: string) {
  const { mode, identifier } = loginAccountFor(account);
  await page.getByLabel(mode === "applicant" ? "Applicant Number" : "Badge Number").fill(identifier);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

/** Opens the right login page for the account and signs in. */
export async function openLoginAndSignIn(page: Page, account: string | LoginAccount, password: string) {
  await page.goto(`/login?as=${loginAccountFor(account).mode}`);
  await fillLogin(page, account, password);
}
