// usage: node shoot.mjs <email> <outdir> <width> <path...>
import { chromium } from "@playwright/test";
const [email, out, width, ...paths] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const base = "http://localhost:3000";
await page.goto(base + "/login");
await page.getByLabel("Email").fill(email);
await page.getByRole("textbox", { name: "Password" }).fill("DemoPass!2026");
await page.getByRole("button", { name: "Login" }).click();
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 });
for (const path of paths) {
  await page.goto(base + path);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);
  const name = `${out}/${width}${path.replace(/[/?=&]/g, "_")}.png`;
  await page.screenshot({ path: name, fullPage: false });
  console.log(name);
}
await browser.close();
