import type { ApplicantProfileDocument } from "@/lib/types/database";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

/** How many of the five required profile documents are saved, and which are still missing. */
export function requiredDocumentStatus(documents: readonly Pick<ApplicantProfileDocument, "kind">[] | undefined) {
  const savedKinds = new Set((documents ?? []).map((document) => document.kind));
  const missing = APPLICANT_PROFILE_DOCUMENT_KINDS
    .filter(({ kind }) => !savedKinds.has(kind))
    .map(({ kind, label }) => ({ kind, label }));
  const total = APPLICANT_PROFILE_DOCUMENT_KINDS.length;
  return { saved: total - missing.length, total, complete: missing.length === 0, missing };
}
