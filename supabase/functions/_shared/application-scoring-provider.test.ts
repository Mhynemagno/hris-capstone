import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { GeminiApplicationScoringProvider } from "./application-scoring-provider.ts";

const input = {
  cvText: "Candidate has five years of recruitment experience and a bachelor degree.",
  criteria: [{ kind: "experience", requirement: "Three years of recruitment experience", isRequired: true }],
};

Deno.test("Gemini provider returns validated structured recommendation", async () => {
  let body = "";
  const provider = new GeminiApplicationScoringProvider("test-key", async (_url: RequestInfo | URL, init?: RequestInit) => {
    body = String(init?.body);
    return Response.json({ output_text: '{"score":82,"explanation":"Meets the required experience criterion."}' });
  });

  const result = await provider.score(input);

  assertEquals(result, { score: 82, explanation: "Meets the required experience criterion.", provider: "gemini", model: "gemini-2.5-flash-lite", modelVersion: "v1beta" });
  assertEquals(body.includes("Candidate has five years"), true);
  assertEquals(body.includes("response_format"), true);
  assertEquals(body.includes("application_id"), false);
});

Deno.test("Gemini provider rejects malformed structured output", async () => {
  const provider = new GeminiApplicationScoringProvider("test-key", async () => Response.json({ output_text: '{"score":101}' }));

  await assertRejects(() => provider.score(input), Error, "provider_invalid_response");
});
