p = "e2e/capstone-objectives.spec.ts"
s = open(p, encoding="utf-8").read()

def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# Objective 2: HR review block up to the first sign-out.
start = s.index('    await page.goto("/hr/applications");\n    // The queue names each application by its applicant.')
end = s.index("    await signOut(page, HR.email);", start) + len("    await signOut(page, HR.email);")
s = s[:start] + '''    await page.goto("/hr/applications");
    // The queue names each application by its applicant.
    const review = page.getByRole("link", { name: `Aplica Candidate ${runId}`, exact: true });
    await expect(review).toBeVisible({ timeout: 15_000 });
    await expect(review).toHaveAttribute("href", `/hr/applications/${applicationId}`);
    await page.goto(`/hr/applications/${applicationId}`);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`Candidate ${runId}`) })).toBeVisible();
    await page.getByRole("tab", { name: /Documents/ }).click();
    await expect(page.getByRole("heading", { name: "Required profile documents" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^View CV \\/ Resume: / })).toBeVisible();
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
    // The whole cycle runs in the system: interview in San Juan, endorsement to Crame, BMI proof, neuro exam, training.
    await advance(["Under Review", "Interview", "Endorsed to Crame"]);
    await expect(page.getByText("Waiting for the applicant's BMI proof")).toBeVisible();
    await expect(page.getByRole("button", { name: "Move to next stage" })).toBeDisabled();
    await signOut(page, HR.email);''' + s[end:]

rep('''    await page.getByRole("button", { name: "Hire applicant" }).click();
    await page.getByLabel(/^Badge number/).fill(badge);
    await page.getByRole("button", { name: "Confirm hire" }).click();
    await expect(page.getByText("Applicant hired. Their employee record has been created.")).toBeVisible();''', '''    await page.getByRole("button", { name: "Hire applicant" }).click();
    const hireDialog = page.getByRole("dialog", { name: "Hire applicant" });
    await hireDialog.getByLabel(/^Badge number/).fill(badge);
    await hireDialog.getByRole("button", { name: "Hire applicant" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Applicant hired" }).first()).toBeVisible();''')

# Objective 7 dashboard.
start = s.index('    await page.goto("/hr");\n    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30_000 });\n    for (const metric of ["Total Personnel"')
end = s.index('    await expect(page.getByRole("article", { name: "Total Personnel", exact: true })).toContainText(/\\d+/);\n  });', start)
end = s.index("\n  });", end)
s = s[:start] + '''    await page.goto("/hr");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30_000 });
    for (const metric of ["Personnel", "On duty today", "On leave today", "Active deployments", "Open job postings"]) {
      await expect(page.getByRole("article", { name: metric, exact: true })).toContainText(/\\d+/);
    }
    const figure = async (name: string) => Number((await page.getByRole("article", { name, exact: true }).locator("p").nth(1).innerText()).split("/")[0]!.replace(/[^\\d]/g, ""));
    expect(await figure("Active deployments")).toBeGreaterThan(0);
    expect(await figure("Personnel")).toBeGreaterThan(0);
    for (const heading of ["Needs attention", "Recruitment pipeline", "Attendance", "Recent applications"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await signOut(page, HR.email);

    await signIn(page, MANAGEMENT.email, MANAGEMENT.home);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30_000 });
    for (const heading of ["Recruitment pipeline", "Attendance", "Personnel by unit / section", "Personnel by rank"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Needs attention" })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Personnel", exact: true })).toContainText(/\\d+/);''' + s[end:]

open(p, "w", encoding="utf-8").write(s)
print("ok")
