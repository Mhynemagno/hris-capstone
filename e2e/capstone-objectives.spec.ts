import { expect, test, type Page } from "@playwright/test";

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
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${home}$`), { timeout: 30_000 });
}

async function signOut(page: Page, email: string) {
  await page.getByRole("button", { name: new RegExp(`Account menu for ${email}`) }).click();
  await page.getByRole("menu").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
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
  await page.getByLabel(/^Badge number/).fill(person.badge);
  await page.getByLabel(/^Personal email/).fill(`e2e.${runId.toLowerCase()}.${suffix.toLowerCase()}@example.test`);
  await page.getByLabel(/^First name/).fill(person.firstName);
  await page.getByLabel(/^Last name/).fill(person.lastName);
  await page.getByLabel(/^Employment start date/).fill(startedOn);
  await page.getByRole("button", { name: "Save employee" }).click();
  await expect(page).toHaveURL(/\/hr\/employees\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: `${person.firstName} ${person.lastName}` })).toBeVisible();
  return { ...person, id: page.url().split("/").pop() as string, name: `${person.firstName} ${person.lastName}` };
}

async function chooseComboboxOption(page: Page, name: RegExp | string, search: string, option: RegExp | string) {
  await page.getByRole("combobox", { name }).fill(search);
  await page.getByRole("option", { name: option }).first().click();
}

/** HR creates a deployment for the demo employee through the UI; returns its assignment role. */
async function createDeployment(page: Page, role: string) {
  await page.goto("/hr/deployments/new");
  await chooseComboboxOption(page, /^Employee/, "0-00001", /Demo Employee/);
  await page.getByLabel(/^Assignment role/).fill(role);
  await page.getByLabel(/^Location/).fill("San Juan City Police Station");
  await page.getByLabel(/^Start date/).fill(isoDate(0));
  await page.getByRole("button", { name: "Save deployment" }).click();
  await expect(page).toHaveURL(/\/hr\/deployments\/[0-9a-f-]{36}$/, { timeout: 30_000 });
}

test.describe("Objective 1: centralized personnel records", () => {
  test("HR creates a profile and manages its service history and qualifications", async ({ page }) => {
    await signIn(page, HR.email, HR.home);
    const employee = await createEmployee(page, "PR");

    // Official record update.
    await page.getByLabel(/^Department/).first().selectOption({ label: "Intelligence Section" });
    await page.getByLabel(/^Rank/).first().selectOption({ label: "PCpl — Police Corporal" });
    await page.getByRole("button", { name: "Save employee" }).click();
    await page.reload();
    await expect(page.getByLabel(/^Department/).first()).toHaveValue(/\d+/);

    const sections = page.getByRole("tablist", { name: "Personnel record sections" });

    await sections.getByRole("tab", { name: "Service history" }).click();
    const history = page.getByRole("tabpanel", { name: "Service history" });
    await history.getByLabel(/^Start date/).fill("2015-06-01");
    await history.getByLabel(/^Notes/).fill(`Initial assignment ${runId}`);
    await page.getByRole("button", { name: "Add service history" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Service history added." })).toBeVisible();

    await sections.getByRole("tab", { name: "Qualifications" }).click();
    await page.getByLabel(/^Qualification name/).selectOption("Baccalaureate Degree");
    await page.getByLabel(/^Institution/).selectOption("Private College or University");
    await page.getByRole("button", { name: "Add qualification" }).click();
    await expect(page.getByRole("tabpanel", { name: "Qualifications" }).getByRole("alert").filter({ hasText: "This field is required." }).first()).toBeVisible();
    await expect(page.getByText(/Invalid ISO date|Too small|expected string/)).toHaveCount(0);
    await page.getByLabel(/^Awarded date/).fill("2014-04-10");
    await page.getByRole("button", { name: "Add qualification" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Qualification added." })).toBeVisible();

    await sections.getByRole("tab", { name: "Certifications" }).click();
    await page.getByLabel(/^Certificate name/).selectOption("Marksmanship Qualification");
    await page.getByLabel(/^Issuer/).selectOption("PNP Training Service");
    await page.getByLabel(/^Issued date/).fill("2019-08-01");
    await page.getByRole("button", { name: "Add certification" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Certification added." })).toBeVisible();

    await sections.getByRole("tab", { name: "Training" }).click();
    await page.getByLabel(/^Course name/).selectOption("Criminal Investigation Course (CIC)");
    await page.getByLabel(/^Provider/).selectOption("Regional Training Center");
    await page.getByLabel(/^Completed date/).fill("2020-03-15");
    await page.getByRole("button", { name: "Add training" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Training added." })).toBeVisible();

    // Everything persists and the record is findable in the directory.
    await page.reload();
    await sections.getByRole("tab", { name: "Qualifications" }).click();
    // The saved entry, not the matching choice in the add-qualification dropdown.
    await expect(page.getByRole("tabpanel", { name: "Qualifications" }).locator("p", { hasText: /^Baccalaureate Degree$/ })).toBeVisible();
    await sections.getByRole("tab", { name: "Service history" }).click();
    await expect(page.getByRole("tabpanel", { name: "Service history" }).getByText("2015-06-01 – present")).toBeVisible();

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
    await page.getByLabel(/^Department/).selectOption({ label: "Tactical Operations Center" });
    await page.getByLabel(/^Rank/).selectOption({ label: "Pat — Patrolman / Patrolwoman" });
    await page.getByLabel(/^Title/).fill(title);
    await page.getByLabel(/^Description/).fill("A patrol opening published by the capstone objective tests.");
    await page.getByLabel("Criterion 1 type").selectOption("education");
    await page.getByLabel("Qualification 1").selectOption("Baccalaureate degree from a recognized institution");
    await page.getByRole("button", { name: "Publish opening" }).click();
    await expect(page).toHaveURL(/\/hr\/jobs$/);
    await signOut(page, HR.email);

    // A new applicant registers (hiring links a login to exactly one employee record).
    await page.goto("/applicant/register");
    await page.getByLabel("First name").fill("Aplica");
    await page.getByLabel("Last name").fill(`Candidate ${runId}`);
    await page.getByLabel("Email").fill(applicantEmail);
    await page.locator("#registration-password").fill(demoPassword);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/applicant$/, { timeout: 30_000 });

    await page.goto("/applicant/profile");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Profile saved." })).toBeVisible();
    await page.getByLabel("Upload eligibility document").setInputFiles(pdf("eligibility.pdf"));
    await expect(page.getByRole("status").filter({ hasText: "Eligibility document saved." })).toBeVisible();
    await page.getByLabel("Upload diploma document").setInputFiles(pdf("diploma.pdf"));
    await expect(page.getByRole("status").filter({ hasText: "Diploma document saved." })).toBeVisible();

    await page.goto("/jobs");
    await page.getByRole("link", { name: `View ${title} opening` }).click();
    await page.getByRole("link", { name: "Apply for this opening" }).click();
    await page.getByLabel("Cover note").fill("I am applying through the capstone objective tests.");
    await page.getByLabel("CV (PDF)").setInputFiles(pdf("cv.pdf"));
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Application submitted" })).toBeVisible({ timeout: 30_000 });
    const trackHref = await page.getByRole("link", { name: "Track application" }).getAttribute("href");
    const applicationId = trackHref?.split("/").pop() as string;
    expect(applicationId).toMatch(/^[0-9a-f-]{36}$/);
    await signOut(page, applicantEmail);

    // HR tracks the application through its statuses and records the hiring decision.
    await signIn(page, HR.email, HR.home);
    await page.goto("/hr/applications");
    // The queue names each application by its applicant.
    const review = page.getByRole("link", { name: `Review application Aplica Candidate ${runId}` });
    await expect(review).toBeVisible({ timeout: 15_000 });
    await expect(review).toHaveAttribute("href", `/hr/applications/${applicationId}`);
    await page.goto(`/hr/applications/${applicationId}`);
    for (const status of ["Under Review", "Shortlisted"]) {
      await page.getByLabel("Next status").selectOption({ label: status });
      await page.getByRole("button", { name: "Update status" }).click();
      await expect(page.getByRole("status").filter({ hasText: `Status updated to ${status}.` })).toBeVisible();
    }
    await page.getByRole("button", { name: "Hire applicant" }).click();
    await page.getByLabel(/^Badge number/).fill(badge);
    await page.getByRole("button", { name: "Confirm hire" }).click();
    await expect(page.getByText("Applicant hired. Their employee record has been created.")).toBeVisible();

    await page.goto("/hr/employees");
    await page.getByLabel("Search").fill(badge);
    await expect(page.getByRole("link", { name: new RegExp(`View record for Aplica Candidate ${runId}`) })).toBeVisible({ timeout: 15_000 });
    await signOut(page, HR.email);

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
    await page.getByRole("button", { name: "Add unit/station" }).click();
    const panel = page.getByRole("dialog", { name: "Add unit/station" });
    await panel.getByRole("button", { name: "Save unit/station" }).click();
    await expect(panel.getByText("This field is required.")).toBeVisible();
    await panel.getByLabel(/^Name/).fill(unit);
    await panel.getByRole("button", { name: "Save unit/station" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${unit} was added.` })).toBeVisible();
    await page.getByLabel("Search unit stations").fill(unit);
    await expect(page.getByRole("cell", { name: unit, exact: true })).toBeVisible();
    await signOut(page, ADMIN.email);

    await signIn(page, HR.email, HR.home);

    // Validation: a deployment needs a location, unit, or project.
    await page.goto("/hr/deployments/new");
    await chooseComboboxOption(page, /^Employee/, "0-00001", /Demo Employee/);
    await page.getByLabel(/^Assignment role/).fill(role);
    await page.getByLabel(/^Start date/).fill(isoDate(0));
    await page.getByRole("button", { name: "Save deployment" }).click();
    await expect(page.getByText("Provide a location, unit, or project.").first()).toBeVisible();

    await createDeployment(page, role);
    await page.getByLabel(/^Unit assignment/).selectOption({ label: unit });
    await page.getByLabel(/^Project/).fill(`Oplan Ligtas ${runId}`);
    await page.getByRole("button", { name: "Save deployment" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Deployment saved." })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/^Project/)).toHaveValue(`Oplan Ligtas ${runId}`);
    await expect(page.getByLabel(/^Unit assignment/)).toHaveValue(unit);
    await expect(page.getByText(/History/).first()).toBeVisible();

    await page.goto("/hr/deployments");
    await expect(page.getByRole("link", { name: new RegExp(`View details for ${role}`) })).toBeVisible({ timeout: 15_000 });
    await signOut(page, HR.email);

    await signIn(page, EMPLOYEE.email, EMPLOYEE.home);
    await page.goto("/employee/deployments");
    await expect(page.getByText(role).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Objective 4: promotion eligibility tracker", () => {
  test("HR evaluates service years, a performance rating, and a training credential", async ({ page }) => {
    const credential = "Public Safety Junior Leadership Course (PSJLC)";
    await signIn(page, HR.email, HR.home);
    const employee = await createEmployee(page, "PROMO", "2014-01-06");

    // The training credential the criteria require.
    await page.getByRole("tablist", { name: "Personnel record sections" }).getByRole("tab", { name: "Training" }).click();
    await page.getByLabel(/^Course name/).selectOption(credential);
    await page.getByLabel(/^Provider/).selectOption("Regional Training Center");
    await page.getByLabel(/^Completed date/).fill("2021-05-20");
    await page.getByRole("button", { name: "Add training" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Training added." })).toBeVisible();

    // Each rank has one set of criteria; create them for PCpl on the first run, reuse afterwards.
    await page.goto("/hr/promotions/criteria");
    const existing = page.getByRole("button", { name: /(Deactivate|Activate) criteria for PCpl/ });
    await expect(page.getByText(/Loading promotion criteria/)).toHaveCount(0, { timeout: 15_000 });
    if (await existing.count() === 0) {
      await chooseComboboxOption(page, /^Target rank/, "PCpl", /PCpl — Police Corporal/);
      await page.getByLabel(/^Minimum years of service/).selectOption("3");
      await page.getByLabel(/^Minimum performance rating/).selectOption({ label: "3 – Satisfactory" });
      await page.getByLabel(/^Record type/).selectOption({ label: "Training" });
      await page.getByLabel(/^Required record name/).selectOption(credential);
      await page.getByRole("button", { name: "Save criteria" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Promotion criteria saved." })).toBeVisible();
    } else if (await page.getByRole("button", { name: /^Activate criteria for PCpl/ }).count()) {
      await page.getByRole("button", { name: /^Activate criteria for PCpl/ }).click();
    }

    await page.goto(`/hr/employees/${employee.id}`);
    await page.getByRole("link", { name: "Promotion review" }).click();
    await expect(page).toHaveURL(new RegExp(`/hr/promotions/${employee.id}$`));
    await page.getByLabel(/^Overall rating/).selectOption({ label: "4 – Very satisfactory" });
    await page.getByLabel(/^Review period start/).fill("2025-01-01");
    await page.getByLabel(/^Review period end/).fill("2025-12-31");
    await page.locator("#rating-notes").fill(`Rated by the objective tests ${runId}`);
    await page.getByRole("button", { name: "Save rating" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Performance rating saved." })).toBeVisible();

    const criterion = page.locator("#criterion option", { hasText: "PCpl" }).first();
    await page.locator("#criterion").selectOption(await criterion.getAttribute("value") as string);
    await page.getByLabel(/^Evaluation date/).fill(isoDate(0));
    await page.getByLabel(/^Recommendation/).selectOption({ label: "Recommended" });
    await page.locator("#evaluation-notes").fill(`Meets service, rating, and training requirements ${runId}`);
    await page.getByRole("button", { name: "Save advisory review" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Advisory review saved for PCpl/ })).toBeVisible();

    await page.goto("/hr/promotions");
    await expect(page.getByRole("link", { name: new RegExp(`Open review for PCpl.*evaluated ${isoDate(0)}`) }).first()).toBeVisible({ timeout: 15_000 });
    await signOut(page, HR.email);

    await signIn(page, EMPLOYEE.email, EMPLOYEE.home);
    await page.goto("/employee/promotion-eligibility");
    await expect(page.getByRole("heading", { name: "Promotion eligibility" })).toBeVisible();
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
    await page.getByLabel(/^Reason/).fill(reason);
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Leave request submitted/ })).toBeVisible();
    await signOut(page, EMPLOYEE.email);

    await signIn(page, HR.email, HR.home);
    await page.goto("/hr/leave-requests");
    await page.getByRole("link", { name: new RegExp(`Review Demo leave request, ${start}`) }).first().click();
    await expect(page.getByText(reason)).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/^Decision note/).fill("Staffing is short on these dates.");
    await page.getByRole("button", { name: "Reject request" }).click();
    await expect(page.getByRole("status").filter({ hasText: /rejected/i })).toBeVisible();
    await signOut(page, HR.email);

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
    await expect(row).toContainText("late");
    await expect(row).toContainText("Import");
    // Biometric login/logout (face) entry points; the camera journey is e2e/face-attendance.spec.ts.
    await expect(page.getByRole("link", { name: "Attendance kiosk" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Face registration" })).toBeVisible();

    await page.goto("/reports/attendance-leave");
    await expect(page.getByRole("heading", { name: "Attendance and leave" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: employee.badge })).toContainText("late", { timeout: 15_000 });
    await signOut(page, HR.email);

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
    await expect(page.getByRole("heading", { name: "HR operations dashboard" })).toBeVisible({ timeout: 30_000 });
    for (const metric of ["Active personnel", "Active deployments", "Recruitment applications", "Attendance exceptions", "Pending leave", "Promotion ready", "Training needs"]) {
      await expect(page.getByRole("article", { name: metric })).toContainText(/\d+/);
    }
    expect(Number(await page.getByRole("article", { name: "Active deployments" }).locator("p").nth(1).innerText())).toBeGreaterThan(0);
    expect(Number(await page.getByRole("article", { name: "Active personnel" }).locator("p").nth(1).innerText())).toBeGreaterThan(0);
    for (const heading of ["Recruitment pipeline", "Deployment status", "Attendance status", "Leave status"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await signOut(page, HR.email);

    await signIn(page, MANAGEMENT.email, MANAGEMENT.home);
    await expect(page.getByRole("heading", { name: "Personnel analytics" })).toBeVisible({ timeout: 30_000 });
    for (const heading of ["Personnel by department", "Recruitment pipeline", "Deployment status", "Attendance and leave exceptions"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(page.getByRole("article", { name: "Promotion ready" })).toContainText(/\d+/);
    await expect(page.getByRole("article", { name: "Training needs" })).toContainText(/\d+/);
  });
});

test.describe("Objective 8: automated reports", () => {
  test("HR generates, filters, and downloads reports; management reads them", async ({ page }) => {
    const role = `E2E Report ${runId}`;
    await signIn(page, HR.email, HR.home);
    await createDeployment(page, role);

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
    await signOut(page, HR.email);

    await signIn(page, MANAGEMENT.email, MANAGEMENT.home);
    await page.goto("/reports/deployments");
    await expect(page.getByRole("heading", { name: "Deployments" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download CSV" })).toBeEnabled({ timeout: 15_000 });
  });
});
