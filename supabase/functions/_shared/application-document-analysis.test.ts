import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { prepareApplicationDocuments } from "./application-document-analysis.ts";

Deno.test("accepts supported applicant documents within the analysis limits", () => {
  const documents = prepareApplicationDocuments([
    { fileName: "cv.pdf", mimeType: "application/pdf", bytes: new Uint8Array([1, 2, 3]) },
    { fileName: "certificate.png", mimeType: "image/png", bytes: new Uint8Array([4, 5]) },
  ]);

  assertEquals(documents.map((document: { fileName: string }) => document.fileName), ["cv.pdf", "certificate.png"]);
});

Deno.test("rejects a document that exceeds the configured analysis limit", async () => {
  await assertRejects(
    async () => prepareApplicationDocuments([
      { fileName: "too-large.pdf", mimeType: "application/pdf", bytes: new Uint8Array(10 * 1024 * 1024 + 1) },
    ]),
    Error,
    "provider_invalid_response",
  );
});
