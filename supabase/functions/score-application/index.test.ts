import { assertEquals } from "jsr:@std/assert@1";

import { createScoreApplicationHandler } from "./index.ts";

Deno.test("retires the pasted-CV analysis endpoint", async () => {
  const handler = createScoreApplicationHandler();
  const response = await handler(new Request("https://project.supabase.co/functions/v1/score-application", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicationId: "123e4567-e89b-42d3-a456-426614174000",
      cvText: "A".repeat(80),
      confirmedAnonymized: true,
    }),
  }));

  assertEquals(response.status, 410);
  assertEquals(await response.json(), { error: "Manual analysis is no longer available." });
});
