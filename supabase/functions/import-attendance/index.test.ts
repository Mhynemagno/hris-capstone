import { assertEquals } from "jsr:@std/assert@1";

import { createImportAttendanceHandler } from "./index.ts";

Deno.test("rejects an import without an authenticated request", async () => {
  const handler = createImportAttendanceHandler({ getEnv: () => "" });
  const response = await handler(new Request("https://project.supabase.co/functions/v1/import-attendance", { method: "POST" }));

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: "Authentication is required." });
});
