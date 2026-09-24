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

  assertEquals(result, { score: 82, explanation: "Meets the required experience criterion.", provider: "gemini", model: "gemini-3.5-flash-lite", modelVersion: "v1beta" });
  assertEquals(body.includes("Candidate has five years"), true);
  assertEquals(body.includes("response_format"), true);
  assertEquals(body.includes("application_id"), false);
  assertEquals(JSON.parse(body).store, false);
});

Deno.test("Gemini provider rejects malformed structured output", async () => {
  const provider = new GeminiApplicationScoringProvider("test-key", async () => Response.json({ output_text: '{"score":101}' }));

  await assertRejects(() => provider.score(input), Error, "provider_invalid_response");
});

Deno.test("Gemini provider scores uploaded PDF and image evidence", async () => {
  let body = "";
  const provider = new GeminiApplicationScoringProvider("test-key", async (_url: RequestInfo | URL, init?: RequestInit) => {
    body = String(init?.body);
    return Response.json({ output_text: '{"score":91,"explanation":"CV and certification satisfy the criteria."}' });
  });

  const result = await provider.analyzeDocuments({
    documents: [
      { fileName: "cv.pdf", mimeType: "application/pdf", bytes: new TextEncoder().encode("CV") },
      { fileName: "certificate.png", mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) },
    ],
    criteria: input.criteria,
  });

  assertEquals(result.score, 91);
  assertEquals(body.includes('"type":"document"'), true);
  assertEquals(body.includes('"mime_type":"application/pdf"'), true);
  assertEquals(body.includes('"mime_type":"image/png"'), true);
  assertEquals(JSON.parse(body).store, false);
});

Deno.test("Gemini provider uses a currently available model and sends images as image input", async () => {
  let body: { model?: string; input?: Array<{ type: string; mime_type?: string }> } = {};
  const provider = new GeminiApplicationScoringProvider("test-key", async (_url: RequestInfo | URL, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ output_text: '{"score":70,"explanation":"Partly meets the criteria."}' });
  });

  const result = await provider.analyzeDocuments({
    documents: [
      { fileName: "cv.pdf", mimeType: "application/pdf", bytes: new TextEncoder().encode("CV") },
      { fileName: "id.jpg", mimeType: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) },
    ],
    criteria: input.criteria,
  });

  assertEquals(body.model, "gemini-3.5-flash-lite");
  assertEquals(result.model, "gemini-3.5-flash-lite");
  assertEquals(body.input?.slice(0, 2).map((part) => [part.type, part.mime_type]), [["document", "application/pdf"], ["image", "image/jpeg"]]);
});

Deno.test("Gemini provider reads the answer from the REST steps output", async () => {
  const provider = new GeminiApplicationScoringProvider("test-key", async () => Response.json({
    object: "interaction",
    status: "completed",
    steps: [
      { type: "user_input", content: [{ type: "text", text: "ignored" }] },
      { type: "model_output", content: [{ type: "text", text: '{"score":64,"explanation":"Meets two of three criteria."}' }] },
    ],
  }));

  const result = await provider.analyzeDocuments({
    documents: [{ fileName: "cv.pdf", mimeType: "application/pdf", bytes: new TextEncoder().encode("CV") }],
    criteria: input.criteria,
  });

  assertEquals([result.score, result.explanation], [64, "Meets two of three criteria."]);
});

Deno.test("Gemini provider logs the HTTP status and error body when Gemini rejects a request", async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const provider = new GeminiApplicationScoringProvider("test-key", async () => new Response('{"error":{"message":"model not found"}}', { status: 404 }));
    await assertRejects(() => provider.analyzeDocuments({
      documents: [{ fileName: "cv.pdf", mimeType: "application/pdf", bytes: new TextEncoder().encode("CV") }],
      criteria: input.criteria,
    }), Error, "provider_unavailable");
  } finally {
    console.error = original;
  }
  assertEquals(logged.length, 1);
  assertEquals(String(logged[0]).includes("404"), true);
  assertEquals(String(logged[0]).includes("model not found"), true);
});
