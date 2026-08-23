import { assertEquals } from "jsr:@std/assert@1";

import { createScoreApplicationHandler } from "./index.ts";

const applicationId = "123e4567-e89b-42d3-a456-426614174000";

function request(body: unknown, token = "access-token") {
  return new Request("https://project.supabase.co/functions/v1/score-application", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects scoring without anonymization confirmation", async () => {
  const handler = createScoreApplicationHandler();
  const response = await handler(request({ applicationId, cvText: "A".repeat(80), confirmedAnonymized: false }));

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "Invalid analysis request." });
});
