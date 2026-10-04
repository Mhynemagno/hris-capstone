import { describe, expect, it } from "vitest";

import { requiredDocumentStatus } from "./required-documents";

describe("requiredDocumentStatus", () => {
  it("counts saved kinds and names the missing ones in display order", () => {
    const status = requiredDocumentStatus([{ kind: "diploma" }, { kind: "resume" }, { kind: "diploma" }]);
    expect(status).toEqual({
      saved: 2,
      total: 5,
      complete: false,
      missing: [
        { kind: "psa", label: "PSA birth certificate" },
        { kind: "photo", label: "2x2 picture" },
        { kind: "eligibility", label: "Eligibility" },
      ],
    });
  });

  it("is complete when all five are saved, and empty for no data", () => {
    expect(requiredDocumentStatus(["resume", "psa", "photo", "eligibility", "diploma"].map((kind) => ({ kind: kind as never }))).complete).toBe(true);
    expect(requiredDocumentStatus(undefined)).toMatchObject({ saved: 0, total: 5, complete: false });
  });
});
