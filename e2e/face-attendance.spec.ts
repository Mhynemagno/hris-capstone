import { expect, test, type Page } from "@playwright/test";

// Chromium's synthetic camera shows a test pattern, not a face. These journeys prove the models
// load from the production bundle, the camera starts and stops, and detection runs with the
// "no face" guidance. Recognising a real face needs a consenting person in front of a camera.
test.use({
  permissions: ["camera"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

// Headless Edge (the Windows default in playwright.config.ts) ends fake camera tracks after about a
// second, which correctly stops the scanner. Run this file with --headed there.
test.skip(({ channel, headless }) => headless && channel === "msedge", "Headless Edge ends fake camera tracks; run with --headed.");

test.describe.configure({ timeout: 120_000 });

const demoPassword = process.env.HRIS_E2E_PASSWORD ?? "DemoPass!2026";

/**
 * Edge's fake capture device sometimes ends a fresh stream within a second. The app reports that
 * as a camera failure; recover through the app's own retry button, at most twice.
 */
async function waitRecoveringFromFakeCamera(page: Page, expected: RegExp | string, retryButton: RegExp) {
  const target = page.getByRole("status").filter({ hasText: expected });
  const cameraFailure = page.getByRole("alert").filter({ hasText: /camera could not be started|camera was turned off|no camera was found/i });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await expect(target.or(cameraFailure).first()).toBeVisible({ timeout: 60_000 });
    if (!(await cameraFailure.first().isVisible())) return;
    await page.getByRole("button", { name: retryButton }).click();
  }
  await expect(target).toBeVisible();
}

async function signInAsHr(page: Page, destination: string) {
  await page.goto(destination);
  await page.getByLabel("Email").fill("demo.hr@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
}

test("the attendance kiosk loads models, starts the camera, and asks for a face", async ({ page }) => {
  await signInAsHr(page, "/hr/attendance/kiosk");
  await page.getByRole("button", { name: "Open scanner" }).click();

  await waitRecoveringFromFakeCamera(page, "Scanner ready.", /try again/i);
  await page.getByRole("button", { name: "Start scanning" }).click();
  await expect(page.getByRole("status").filter({ hasText: /No face detected|Look at the camera/ })).toBeVisible({ timeout: 15_000 });

  const liveTracks = () => page.evaluate(() => {
    const video = document.querySelector("video");
    const stream = video?.srcObject as MediaStream | null | undefined;
    return stream ? stream.getTracks().filter((track) => track.readyState === "live").length : 0;
  });
  expect(await liveTracks()).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Close scanner" }).click();
  await expect(page.getByLabel("Camera preview")).toHaveCount(0);
});

test("face registration requires consent and guides the capture", async ({ page }) => {
  await signInAsHr(page, "/hr/attendance/face-enrollment");
  const employee = page.getByRole("combobox", { name: "Employee" });
  await employee.click();
  await page.getByRole("option").first().click();

  const start = page.getByRole("button", { name: /Start face registration|Re-register face/ });
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox").check();
  await start.click();

  await waitRecoveringFromFakeCamera(page, /No face detected|Hold still/, /try again/i);
  await expect(employee).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: /Start face registration|Re-register face/ })).toBeVisible();
});

test("an employee reaches face attendance with their own login, without HR", async ({ page }) => {
  await page.goto("/employee/attendance/scan");
  await page.getByLabel("Email").fill("demo.employee@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/employee\/attendance\/scan$/);
  // The demo employee has no face registration, so the page explains how to get one.
  await expect(page.getByText(/Face registration needed|Record attendance with your face/)).toBeVisible();

  await page.goto("/hr/attendance/kiosk");
  await expect(page).toHaveURL(/\/unauthorized$/);
});
