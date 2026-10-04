import { describe, expect, it } from "vitest";

import { APPLICANT_PROFILE_DOCUMENT_KINDS, profileDocumentFileSchemaFor } from "./applicant-portal";

const file = (name: string, type: string) => new File(["x"], name, { type });

describe("profileDocumentFileSchemaFor", () => {
  it("accepts only PDFs for the CV / Resume, PSA, Eligibility, and Diploma", () => {
    for (const { kind, label } of APPLICANT_PROFILE_DOCUMENT_KINDS.filter(({ kind }) => kind !== "photo")) {
      expect(profileDocumentFileSchemaFor(kind).safeParse(file("doc.pdf", "application/pdf")).success).toBe(true);
      const image = profileDocumentFileSchemaFor(kind).safeParse(file("doc.png", "image/png"));
      expect(image.success).toBe(false);
      expect(image.error?.issues[0]?.message).toBe(`Upload the ${label} as a PDF file.`);
    }
  });

  it("keeps the 2x2 picture PNG or JPEG only", () => {
    expect(profileDocumentFileSchemaFor("photo").safeParse(file("p.jpg", "image/jpeg")).success).toBe(true);
    expect(profileDocumentFileSchemaFor("photo").safeParse(file("p.pdf", "application/pdf")).success).toBe(false);
  });

  it("tells the browser to offer only PDFs for the four document kinds", () => {
    expect(APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, accept }) => [kind, accept])).toEqual([
      ["resume", "application/pdf"],
      ["psa", "application/pdf"],
      ["photo", "image/png,image/jpeg"],
      ["eligibility", "application/pdf"],
      ["diploma", "application/pdf"],
    ]);
  });
});
