import { expect, test, type Page } from "@playwright/test";

import { formatDate } from "../src/lib/format-date";

// One end-to-end journey per capstone objective (see docs/capstone-objectives-verification.md).
// Every test creates its own uniquely named records in the LOCAL Supabase stack only
// (playwright.config.ts refuses non-local URLs), so the suite can be re-run.

const demoPassword = process.env.HRIS_E2E_PASSWORD ?? "DemoPass!2026";
const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();

/** A random badge number in the PNP 0-00000 format, so runs do not collide (never the seeded 0-00001). */
function uniqueBadge() {
  const digits = String(100_000 + Math.floor(Math.random() * 900_000));
  return `${digits[0]}-${digits.slice(1)}`;
}

test.describe.configure({ timeout: 120_000 });

const HR = { email: "demo.hr@example.test", home: "/hr" };
const EMPLOYEE = { email: "demo.employee@example.test", home: "/employee" };
const MANAGEMENT = { email: "demo.management@example.test", home: "/management" };
const ADMIN = { email: "demo.admin@example.test", home: "/admin" };

// A minimal, valid PDF: the upload checks the file signature.
const pdf = (name: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"),
});

async function signIn(page: Page, email: string, home: string, password = demoPassword) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(new RegExp(`${home}$`), { timeout: 30_000 });
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
}

function isoDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

/** HR creates a personnel record through the UI and returns its id. */
async function createEmployee(page: Page, suffix: string, startedOn = "2015-06-01") {
  const person = { badge: uniqueBadge(), firstName: "Etoe", lastName: `Tester ${suffix}${runId}` };
  await page.goto("/hr/employees/new");
  await page.getByLabel(/^Rank/).selectOption({ label: "PAT — Patrolman / Patrolwoman" });
  await page.getByLabel(/^Badge number/).fill(person.badge);
  await page.getByLabel(/^Personal email/).fill(`e2e.${runId.toLowerCase()}.${suffix.toLowerCase()}@example.test`);
  await page.getByLabel(/^First name/).fill(person.firstName);
  await page.getByLabel(/^Last name/).fill(person.lastName);
  await page.getByLabel(/^Place of birth/).fill("San Juan City");
  await page.getByLabel(/^Date of birth/).fill("1995-05-15");
  await page.getByLabel(/^Gender/).selectOption("female");
  await page.getByLabel(/^Civil status/).selectOption("single");
  await page.getByLabel(/^Religion/).selectOption("Roman Catholic");
  await page.locator("#phone").fill("+639171234567");
  await page.getByLabel(/^Home address/).fill("1 Test St., San Juan City");
  await page.locator("#emergency-contact-name").fill("Test Contact");
  await page.locator("#emergency-contact-phone").fill("+639181234567");
  await page.getByLabel(/^Unit \/ Section/).selectOption({ label: "Office of the Chief of Police" });
  await page.getByLabel(/^Date Entered Service/).fill(startedOn);
  await page.getByRole("button", { name: "Save employee" }).click();
  await expect(page).toHaveURL(/\/hr\/employees\/[0-9a-f-]{36}\?tab=official&saved=created$/, { timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: "Employee account has been saved." })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${person.firstName} ${person.lastName}` })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").pop() as string;
  return { ...person, id, name: `${person.firstName} ${person.lastName}` };
}

async function chooseComboboxOption(page: Page, name: RegExp | string, search: string, option: RegExp | string) {
  await page.getByRole("combobox", { name }).fill(search);
  await page.getByRole("option", { name: option }).first().click();
}

/** A distinct far-future start day per created deployment, so repeated runs never double-book the demo employee. */
let deploymentDayCounter = 0;
function uniqueDeploymentDay() {
  deploymentDayCounter += 1;
  const seed = Number.parseInt(runId.replace(/\D/g, "").slice(-6) || "0", 10);
  return 3650 + ((seed * 7 + deploymentDayCounter) % 20000);
}

/** HR creates a deployment for the demo employee through the UI at the given (unique) location. */
async function createDeployment(page: Page, location: string, { startDay = uniqueDeploymentDay(), status = "ongoing" }: { startDay?: number; status?: string } = {}) {
  await page.goto("/hr/deployments/new");
  await chooseComboboxOption(page, /^Employee/, "0-00001", /Demo Employee/);
  await page.getByLabel(/^Location/).fill(location);
  await page.getByLabel(/^Remarks/).fill("Initial assignment");
  await page.getByLabel(/^Start date/).fill(isoDate(startDay));
  await page.getByLabel(/^Deployment type/).selectOption("Public Assembly");
  await page.getByLabel(/^Event \/ Operation/).selectOption("Rally");
  await page.getByLabel(/^Status/).selectOption(status);
  await page.getByRole("button", { name: "Save deployment" }).click();
  await expect(page).toHaveURL(/\/hr\/deployments\/[0-9a-f-]{36}$/, { timeout: 30_000 });
}

test.describe("Objective 1: centralized personnel records", () => {
  test("HR creates a profile and manages its service history and qualifications", async ({ page }) => {
    await signIn(page, HR.email, HR.home);
    const employee = await createEmployee(page, "PR");

    // Viewing is read-only; editing happens in edit mode.
    await expect(page.getByRole("button", { name: "Save employee" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit details" }).click();
    await expect(page).toHaveURL(/mode=edit/);

    // Official record update.
    await page.getByLabel(/^Unit \/ Section/).first().selectOption({ label: "Traffic and Investigation Section" });
    await page.getByLabel(/^Rank/).first().selectOption({ label: "PCPL — Police Corporal" });
    await page.getByRole("button", { name: "Save employee" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Employee account has been edited successfully." })).toBeVisible();
    await page.goto(`/hr/employees/${employee.id}?tab=official&mode=edit`);
    await expect(page.getByLabel(/^Unit \/ Section/).first()).toHaveValue(/\d+/);

    const sections = page.getByRole("tablist", { name: "Personnel record sections" });

    await sections.getByRole("tab", { name: "Service history" }).click();
    const history = page.getByRole("tabpanel", { name: "Service history" });
    await history.getByLabel(/^Start date/).fill("2015-06-01");
    await history.getByLabel(/^Remarks/).fill(`Initial assignment ${runId}`);
    // Unit / Section and Rank are required; the end date is not.
    await page.getByRole("button", { name: "Add service history" }).click();
    await expect(history.getByText("Choose a unit / section.")).toBeVisible();
    await expect(history.getByText("Choose a rank.")).toBeVisible();
    await history.getByLabel(/^Unit \/ Section/).selectOption({ label: "Traffic and Investigation Section" });
    await history.getByLabel(/^Rank/).selectOption({ label: "PCPL — Police Corporal" });
    await page.getByRole("button", { name: "Add service history" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Service history added." })).toBeVisible();
    // The new entry shows right away, without a reload.
    await expect(history.getByText("June 1, 2015 to present")).toBeVisible();

    await sections.getByRole("tab", { name: "Eligibility" }).click();
    await page.locator("#qualification-primary").selectOption("NAPOLCOM PNP Entrance Examination");
    await page.getByRole("button", { name: "Add eligibility" }).click();
    await expect(page.getByRole("tabpanel", { name: "Eligibility" }).getByRole("alert").filter({ hasText: "This field is required." }).first()).toBeVisible();
    await expect(page.getByText(/Invalid ISO date|Too small|expected string/)).toHaveCount(0);
    await page.getByLabel(/^Date awarded/).fill("2014-04-10");
    await page.getByRole("button", { name: "Add eligibility" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Eligibility added." })).toBeVisible();

    await sections.getByRole("tab", { name: "Certification / Training" }).click();
    await page.locator("#certification-primary").selectOption("Public Safety Basic Recruit Course (PSBRC)");
    await page.getByLabel(/^Completion date/).fill("2019-08-01");
    await page.getByRole("button", { name: "Add certification / training" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Certification / Training added." })).toBeVisible();

    // Everything persists and the record is findable in the directory.
    await page.reload();
    await sections.getByRole("tab", { name: "Eligibility" }).click();
    // The saved entry, not the matching choice in the add-qualification dropdown.
    await expect(page.getByRole("tabpanel", { name: "Eligibility" }).locator("p", { hasText: /^NAPOLCOM PNP Entrance Examination$/ })).toBeVisible();
    await sections.getByRole("tab", { name: "Service history" }).click();
    await expect(page.getByRole("tabpanel", { name: "Service history" }).getByText("June 1, 2015 to present")).toBeVisible();

    await page.goto("/hr/employees");
    await page.getByLabel("Search").fill(employee.badge);
    await expect(page.getByRole("link", { name: `View record for ${employee.name}` })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Objective 2: recruitment management", () => {
  test("an applicant applies, HR tracks the application, and hires them into a personnel record", async ({ page }) => {
    const title = `E2E Recruit ${runId}`;
    const applicantEmail = `e2e.applicant.${runId.toLowerCase()}@example.test`;
    const badge = uniqueBadge();

    await signIn(page, HR.email, HR.home);
    await page.goto("/hr/jobs/new");
    await page.getByLabel(/^Title/).fill(title);
    await page.getByLabel(/^Location/).fill("San Juan City Police Station");
    await page.getByLabel(/^Deadline of Application/).fill("2099-12-31");
    await page.getByLabel(/^Description/).fill("A patrol opening published by the capstone objective tests.");
    await page.getByLabel(/^Requirement 1: Education/).selectOption("Baccalaureate Degree");
    await page.getByLabel(/^Requirement 2: Eligibility/).selectOption("NAPOLCOM PNP Entrance Examination");
    await page.getByRole("button", { name: "Publish opening" }).click();
    await expect(page).toHaveURL(/\/hr\/jobs$/);
    await signOut(page);

    // A new applicant registers (hiring links a login to exactly one employee record).
    await page.goto("/applicant/register");
    await page.getByLabel(/^Email/).fill(applicantEmail);
    await page.getByLabel(/^Mobile Number/).fill("09171234567");
    await page.getByLabel(/^Last Name/).fill(`Candidate ${runId}`);
    await page.getByLabel(/^First Name/).fill("Aplica");
    await page.getByLabel(/^Middle Name/).fill("Objective");
    await page.getByLabel(/^Qualifier/).selectOption("None");
    await page.getByLabel(/^Birthdate/).fill("1998-04-12");
    await page.locator("#registration-password").fill(demoPassword);
    await page.locator("#registration-confirm-password").fill(demoPassword);
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/jobs$/, { timeout: 30_000 });

    // The personal data sheet requires the personal information and Primary, Secondary and
    // Bachelor's Degree education (qualifier, birthdate and mobile number come from registration;
    // citizenship defaults to Filipino).
    await page.goto("/applicant/profile");
    await page.getByLabel(/^Place of birth/).fill("San Juan City");
    await page.getByLabel(/^Gender/).selectOption("female");
    await page.getByLabel(/^Civil status/).selectOption("single");
    await page.getByLabel(/^Religion/).selectOption("Roman Catholic");
    await page.getByLabel(/^Home address/).fill("12 Mabini St., San Juan City");
    for (const [level, school, course, year] of [["Primary", "San Juan Elementary School", "Primary Education", "2010"], ["Secondary", "San Juan National High School", "Senior High School", "2016"], ["Bachelor's Degree", "Polytechnic University of the Philippines", "BS Criminology", "2020"]]) {
      const group = page.getByRole("group", { name: level, exact: true });
      await group.getByLabel(/^Name of school/).fill(school);
      await group.getByLabel(/^Course completed/).fill(course);
      await group.getByLabel(/^Year graduated/).fill(year);
      await group.getByLabel(/^Location/).fill("Metro Manila");
    }
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Profile saved." })).toBeVisible();
    await page.goto("/applicant/documents");
    // A minimal PNG (1x1 pixel) for the 2x2 picture, which must be an image.
    const png = { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64") };
    for (const [label, file] of [["CV / Resume", pdf("resume.pdf")], ["PSA birth certificate", pdf("psa.pdf")], ["2x2 picture", png], ["Eligibility", pdf("eligibility.pdf")], ["Diploma", pdf("diploma.pdf")]] as const) {
      await page.getByLabel(`Upload ${label} document`).setInputFiles(file);
    }
    await page.getByRole("button", { name: "Save documents" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Documents saved." })).toBeVisible();
    await expect(page.getByText("5 of 5 required documents saved")).toBeVisible();

    await page.goto("/jobs");
    await page.getByRole("link", { name: `View details for ${title}` }).click();
    await page.getByRole("button", { name: "Apply now" }).click();
    await page.getByRole("checkbox", { name: /I have read and agree/ }).check();
    await page.getByRole("button", { name: "I Agree & Continue" }).click();
    await expect(page).toHaveURL(/\/applicant\/apply\/\d+$/);
    await expect(page.getByLabel("CV (PDF)")).toHaveCount(0);
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Application submitted" })).toBeVisible({ timeout: 30_000 });
    const trackHref = await page.getByRole("link", { name: "Track application" }).getAttribute("href");
    const applicationId = trackHref?.split("/").pop() as string;
    expect(applicationId).toMatch(/^[0-9a-f-]{36}$/);
    await signOut(page);

    // HR tracks the application through its statuses and records the hiring decision.
    await signIn(page, HR.email, HR.home);
    await page.goto("/hr/applications");
    // The queue names each application by its applicant.
    const review = page.getByRole("link", { name: `Aplica Candidate ${runId}`, exact: true });
    await expect(review).toBeVisible({ timeout: 15_000 });
    await expect(review).toHaveAttribute("href", `/hr/applications/${applicationId}`);
    await page.goto(`/hr/applications/${applicationId}`);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`Candidate ${runId}`) })).toBeVisible();
    await page.getByRole("tab", { name: /Documents/ }).click();
    await expect(page.getByRole("heading", { name: "Required profile documents" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^View CV \/ Resume: / })).toBeVisible();
    const advance = async (statuses: string[]) => {
      for (const status of statuses) {
        await page.getByRole("button", { name: "Move to next stage" }).click();
        const dialog = page.getByRole("dialog", { name: "Move to next stage" });
        await dialog.getByRole("radio", { name: status }).click();
        await dialog.getByRole("button", { name: `Move to ${status}` }).click();
        await expect(page.getByRole("status").filter({ hasText: `Moved to ${status}` }).first()).toBeVisible();
        await expect(dialog).toBeHidden();
      }
    };
    await advance([
      "Physical Agility Test",
      "Physical & Medical Examination",
      "Neuro-Psychiatric Examination",
      "Drug Test",
      "Character & Background Investigation",
      "Panel Interview",
      "Final Evaluation",
      "Shortlisted",
    ]);
    await page.getByRole("button", { name: "Hire applicant" }).click();
    const hireDialog = page.getByRole("dialog", { name: "Hire applicant" });
    await hireDialog.getByLabel(/^Badge number/).fill(badge);
    await hireDialog.getByRole("button", { name: "Hire applicant" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Applicant hired" }).first()).toBeVisible();

    await page.goto("/hr/employees");
    await page.getByLabel("Search").fill(badge);
    await expect(page.getByRole("link", { name: new RegExp(`View record for Aplica Candidate ${runId}`) })).toBeVisible({ timeout: 15_000 });
    await signOut(page);

    // The applicant is kept informed of every status change.
    await signIn(page, applicantEmail, "/applicant");
    await page.goto("/notifications");
    await expect(page.getByText("Application updated").first()).toBeVisible();
  });
});

test.describe("Objective 3: deployment tracking", () => {
  test("HR assigns and updates a deployment, and the employee can monitor it", async ({ page }) => {
    const role = `E2E Patrol ${runId}`;
    const unit = `E2E Precinct ${runId}`;

    // The administrator maintains the Unit/Station catalogue that deployments use.
    await signIn(page, ADMIN.email, ADMIN.home);
    await page.goto("/admin/unit-stations");
    await page.getByRole("button", { name: "Add unit / station" }).click();
    const panel = page.getByRole("dialog", { name: "Add unit / station" });
    await panel.getByRole("button", { name: "Save unit / station" }).click();
    await expect(panel.getByText("This field is required.")).toBeVisible();
    await panel.getByLabel(/^Name/).fill(unit);
    await panel.getByRole("button", { name: "Save unit / station" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${unit} was added.` })).toBeVisible();
    await page.getByLabel("Search units / stations").fill(unit);
    await expect(page.getByRole("cell", { name: unit, exact: true })).toBeVisible();
    await signOut(page);

    await signIn(page, HR.email, HR.home);

    // Validation: a deployment needs a location and remarks.
    await page.goto("/hr/deployments/new");
    await chooseComboboxOption(page, /^Employee/, "0-00001", /Demo Employee/);
    await page.getByLabel(/^Start date/).fill(isoDate(0));
    await page.getByRole("button", { name: "Save deployment" }).click();
    await expect(page.getByText("Location is required.").first()).toBeVisible();
    await expect(page.getByText("Remarks are required.").first()).toBeVisible();

    await createDeployment(page, role);
    await expect(page.getByText("Deployment created by").first()).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("link", { name: "Update" }).click();
    await expect(page).toHaveURL(/\/hr\/deployments\/[0-9a-f-]{36}\/edit$/);
    await page.getByLabel(/^Remarks/).fill(`Oplan Ligtas ${runId}`);
    await page.getByRole("button", { name: "Save deployment" }).click();
    await expect(page).toHaveURL(/\/hr\/deployments\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText(`Oplan Ligtas ${runId}`)).toBeVisible();
    await expect(page.getByText("Details updated by").first()).toBeVisible();

    await page.goto("/hr/deployments");
    await expect(page.getByRole("link", { name: new RegExp(`View details for ${role}`) })).toBeVisible({ timeout: 15_000 });
    await signOut(page);

    await signIn(page, EMPLOYEE.email, EMPLOYEE.home);
    await page.goto("/employee/deployments");
    await expect(page.getByText(role).first()).toBeVisible({ timeout: 15_000 });

    // The employee is notified of the assignment.
    await page.goto("/notifications");
    await expect(page.getByText(`You are deployed to ${role}`).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Objective 4: promotion eligibility tracker", () => {
  test("HR evaluates service years, a rubric performance evaluation, and a training credential", async ({ page }) => {
    const credential = "Criminal Investigation Course (CIC) / SOCO";
    await signIn(page, HR.email, HR.home);
    const employee = await createEmployee(page, "PROMO", "2014-01-06");
    // Records are added in edit mode; viewing a record is read-only.
    await page.goto(`/hr/employees/${employee.id}?tab=certifications&mode=edit`);

    // The certification / training the criteria require.
    await page.getByRole("tablist", { name: "Personnel record sections" }).getByRole("tab", { name: "Certification / Training" }).click();
    await page.locator("#certification-primary").selectOption(credential);
    await page.getByLabel(/^Completion date/).fill("2021-05-20");
    await page.getByRole("button", { name: "Add certification / training" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Certification / Training added." })).toBeVisible();

    // Each rank has one set of criteria; create them for PCPL on the first run, reuse afterwards.
    await page.goto("/hr/promotions/criteria");
    const existing = page.getByRole("button", { name: /(Deactivate|Activate) criteria for PCPL/ });
    await expect(page.getByText(/Loading promotion criteria/)).toHaveCount(0, { timeout: 15_000 });
    if (await existing.count() === 0) {
      await chooseComboboxOption(page, /^Target rank/, "PCPL", /PCPL — Police Corporal/);
      await page.getByLabel(/^Years of service/).selectOption("3");
      await expect(page.getByLabel(/^Minimum performance rating/)).toHaveCount(0);
      await page.getByLabel(/^Certification \/ Training/).selectOption(credential);
      // A second requirement row can be added and removed again.
      await page.getByRole("button", { name: "Add another certification / training" }).click();
      await page.getByRole("button", { name: "Remove requirement 2" }).click();
      await page.getByRole("button", { name: "Save criteria" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Promotion criteria saved." })).toBeVisible();
    } else if (await page.getByRole("button", { name: /^Activate criteria for PCPL/ }).count()) {
      await page.getByRole("button", { name: /^Activate criteria for PCPL/ }).click();
    }

    await page.goto(`/hr/employees/${employee.id}`);
    await page.getByRole("link", { name: "Promotion review" }).click();
    await expect(page).toHaveURL(new RegExp(`/hr/promotions/${employee.id}$`));
    // The rubric: 12+ years of service (45) + one specialized training (10) = 55, graded 3.00 Poor.
    const rubric = page.getByRole("region", { name: "Performance evaluation" });
    await expect(rubric.getByRole("row", { name: /Specialized unit training/ })).toContainText("10 / 20");
    await page.getByLabel(/^Review period start/).fill("2025-01-01");
    await page.getByLabel(/^Review period end/).fill("2025-12-31");
    await page.locator("#rating-notes").fill(`Rated by the objective tests ${runId}`);
    await page.getByRole("button", { name: "Save evaluation" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Performance evaluation saved." })).toBeVisible();
    await expect(page.getByText(/55 \/ 100 · 3\.00 Poor/).first()).toBeVisible();

    const criterion = page.locator("#criterion option", { hasText: "PCPL" }).first();
    await page.locator("#criterion").selectOption(await criterion.getAttribute("value") as string);
    await page.getByLabel(/^Evaluation date/).fill(isoDate(0));
    await page.getByLabel(/^Recommendation/).selectOption({ label: "Recommended" });
    await page.locator("#evaluation-notes").fill(`Meets service, rating, and training requirements ${runId}`);
    await page.getByRole("button", { name: "Save advisory review" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Advisory review saved for PCPL/ })).toBeVisible();

    await page.goto("/hr/promotions");
    // One row per employee, from their latest review, with readiness checked against today's records.
    const promotionRow = page.getByRole("row").filter({ has: page.getByRole("link", { name: /Open review for .*PCPL/ }) }).filter({ hasText: formatDate(isoDate(0)) ?? isoDate(0) }).first();
    await expect(promotionRow).toBeVisible({ timeout: 15_000 });
    await expect(promotionRow).toContainText("Ready");
    await signOut(page);

    await signIn(page, EMPLOYEE.email, EMPLOYEE.home);
    await page.goto("/employee/promotion-eligibility");
    await expect(page.getByRole("heading", { name: "Promotion", exact: true })).toBeVisible();
  });
});

test.describe("Objective 5: personnel self-service portal", () => {
  test("an employee signs in securely, views their record, applies for leave, and is notified of HR's decision", async ({ page }) => {
    const reason = `E2E self-service ${runId}`;
    const start = isoDate(120 + Math.floor(Math.random() * 400));

    // Secure login: the portal is not reachable without a session.
    await page.goto("/employee/leave");
    await expect(page).toHaveURL(/\/login\?/);

    await signIn(page, EMPLOYEE.email, EMPLOYEE.home);
    await expect(page.getByText("0-00001").first()).toBeVisible({ timeout: 15_000 });
    await page.goto("/employee/profile");
    await expect(page.getByText("Demo Employee").first()).toBeVisible();

    await page.goto("/employee/leave/new");
    await page.getByLabel(/^Leave type/).selectOption({ label: "Demo leave" });
    await page.getByLabel(/^Start date/).fill(start);
    await page.getByLabel(/^End date/).fill(start);
    await page.getByLabel(/^Notes/).fill(reason);
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Leave request submitted/ })).toBeVisible();
    await signOut(page);

    await signIn(page, HR.email, HR.home);
    await page.goto("/hr/leave-requests");
    await page.getByRole("link", { name: new RegExp(`Review .+'s Demo leave request, ${formatDate(start)}`) }).first().click();
    await expect(page.getByText(reason)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("textbox", { name: "Notes" }).fill("Staffing is short on these dates.");
    await page.getByRole("button", { name: "Reject request" }).click();
    await expect(page.getByRole("status").filter({ hasText: /rejected/i })).toBeVisible();
    await signOut(page);

    await signIn(page, EMPLOYEE.email, EMPLOYEE.home);
    await page.goto("/employee/leave");
    await expect(page.getByRole("article").filter({ hasText: reason })).toContainText(/rejected/i);
    await page.goto("/notifications");
    await expect(page.getByRole("link", { name: "View details for Leave request rejected" }).first()).toBeVisible();
    const unread = page.getByRole("button", { name: "Mark Leave request rejected as read" });
    const before = await unread.count();
    expect(before).toBeGreaterThan(0);
    await unread.first().click();
    await expect(unread).toHaveCount(before - 1);
  });
});

test.describe("Objective 6: attendance monitoring and reporting", () => {
  test("device attendance is imported, matched to personnel, monitored, and reported", async ({ page }) => {
    const deviceId = `E2E${runId}`;
    const today = isoDate(0);
    await signIn(page, HR.email, HR.home);
    const employee = await createEmployee(page, "ATT");

    await page.goto("/hr/attendance/import");
    await page.getByLabel("Attendance file").setInputFiles({
      name: "attendance.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`external_employee_id,source_event_id,attendance_date,time_in,time_out,event_type\n${deviceId},EVT-${runId}-1,${today},08:30,17:00,attendance\n`),
    });
    await page.getByRole("button", { name: "Import attendance" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Imported: 0; duplicates: 0; unmatched: 1; invalid: 0." })).toBeVisible({ timeout: 30_000 });

    // Unknown device IDs are never matched by name; HR maps them to a personnel record.
    await page.goto("/hr/attendance/unmatched");
    await chooseComboboxOption(page, `Employee for ${deviceId}`, employee.badge, new RegExp(employee.name));
    await page.getByRole("article").filter({ hasText: deviceId }).getByRole("button", { name: "Map and resolve" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Mapped ${deviceId}` })).toBeVisible();

    await page.goto("/hr/attendance");
    const row = page.getByRole("row").filter({ hasText: deviceId });
    await expect(row).toContainText("08:30");
    await expect(row).toContainText("17:00");
    await expect(row).toContainText("Late");
    await expect(row).toContainText("Import");
    // Biometric login/logout (face) entry points; the camera journey is e2e/face-attendance.spec.ts.
    await expect(page.getByRole("link", { name: "Attendance kiosk" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Face registration" })).toBeVisible();

    await page.goto("/reports/attendance-leave");
    await expect(page.getByRole("heading", { name: "Attendance and leave" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: employee.badge })).toContainText("late", { timeout: 15_000 });
    await signOut(page);

    await signIn(page, EMPLOYEE.email, EMPLOYEE.home);
    await page.goto("/employee/attendance");
    await expect(page.getByRole("heading", { name: "My attendance" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Scan attendance" }).first()).toBeVisible();
  });
});

test.describe("Objective 7: analytics dashboard", () => {
  test("HR and management dashboards summarize recruitment, deployment, attendance, and promotion data", async ({ page }) => {
    await signIn(page, HR.email, HR.home);
    await createDeployment(page, `E2E Dashboard ${runId}`);
    await page.goto("/hr");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30_000 });
    for (const metric of ["Personnel", "On duty today", "On leave today", "Active deployments", "Open job postings"]) {
      await expect(page.getByRole("article", { name: metric, exact: true })).toContainText(/\d+/);
    }
    const figure = async (name: string) => Number((await page.getByRole("article", { name, exact: true }).locator("p").nth(1).innerText()).split("/")[0]!.replace(/[^\d]/g, ""));
    expect(await figure("Active deployments")).toBeGreaterThan(0);
    expect(await figure("Personnel")).toBeGreaterThan(0);
    for (const heading of ["Recruitment pipeline", "Attendance", "Recent applications"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await page.getByRole("tab", { name: "Needs attention" }).click();
    await expect(page.getByRole("heading", { name: "Needs attention", exact: true })).toBeVisible();
    await signOut(page);

    await signIn(page, MANAGEMENT.email, MANAGEMENT.home);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30_000 });
    for (const heading of ["Recruitment pipeline", "Attendance", "Personnel by unit / section", "Personnel by rank"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Needs attention" })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Personnel", exact: true })).toContainText(/\d+/);
  });
});

test.describe("Objective 8: automated reports", () => {
  test("HR generates, filters, and downloads reports; management reads them", async ({ page }) => {
    const role = `E2E Report ${runId}`;
    await signIn(page, HR.email, HR.home);
    // Dated today so it falls in the report's default 30-day range; completed so it never double-books.
    await createDeployment(page, role, { startDay: 0, status: "completed" });

    await page.goto("/reports");
    for (const report of ["applicant tracking", "hiring decisions", "employee performance", "deployments", "attendance leave", "promotion training needs"]) {
      await expect(page.getByRole("main").getByRole("link", { name: report, exact: true })).toBeVisible();
    }

    await page.goto("/reports/deployments");
    await expect(page.getByRole("heading", { name: "Deployments" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: role })).toBeVisible({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^deployments-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await (await download.createReadStream()).toArray();
    expect(Buffer.concat(csv).toString("utf8")).toContain(role);

    // Filtering to a date range before the deployment excludes it.
    await page.getByLabel("Start date").fill("2000-01-01");
    await page.getByLabel("End date").fill("2000-01-31");
    await expect(page.getByRole("row").filter({ hasText: role })).toHaveCount(0, { timeout: 15_000 });

    for (const [key, heading] of [["applicant-tracking", "Applicant tracking"], ["employee-performance", "Employee performance"], ["promotion-training-needs", "Promotion and training needs"]]) {
      await page.goto(`/reports/${key}`);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    }
    await signOut(page);

    await signIn(page, MANAGEMENT.email, MANAGEMENT.home);
    await page.goto("/reports/deployments");
    await expect(page.getByRole("heading", { name: "Deployments" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download CSV" })).toBeEnabled({ timeout: 15_000 });
  });
});
