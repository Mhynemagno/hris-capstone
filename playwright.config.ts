import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

const localHosts = new Set(["localhost", "127.0.0.1"]);

function getLocalSupabaseEnvironment() {
  // Workers re-evaluate this config; reuse what the main process resolved so
  // `supabase status` runs once instead of once per worker.
  const cachedUrl = process.env.HRIS_E2E_SUPABASE_URL;
  const cachedKey = process.env.HRIS_E2E_SUPABASE_PUBLISHABLE_KEY;
  if (cachedUrl && cachedKey && localHosts.has(new URL(cachedUrl).hostname)) {
    return { url: cachedUrl, publishableKey: cachedKey };
  }

  const status = execSync("npx supabase status --output env", {
    encoding: "utf8",
  });
  const values = new Map<string, string>();

  for (const line of status.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) values.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
  }

  const url = values.get("API_URL");
  const publishableKey = values.get("PUBLISHABLE_KEY") ?? values.get("ANON_KEY");
  if (!url || !publishableKey) {
    throw new Error("Start the local Supabase stack before running Playwright.");
  }
  if (!localHosts.has(new URL(url).hostname)) {
    throw new Error("Playwright is restricted to a local Supabase instance.");
  }

  process.env.HRIS_E2E_SUPABASE_URL = url;
  process.env.HRIS_E2E_SUPABASE_PUBLISHABLE_KEY = publishableKey;
  return { url, publishableKey };
}

const localSupabase = getLocalSupabaseEnvironment();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // A couple of workers keep the run fast without starving the app server.
  workers: process.env.CI ? 1 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  },
  webServer: {
    // Test the production build: `next dev` compiles each route on first visit
    // and was slow and memory-hungry enough to time out or crash mid-run.
    // NEXT_PUBLIC_* values below are inlined at build time, so the build always
    // targets the local Supabase stack.
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: localSupabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localSupabase.publishableKey,
    },
  },
});
