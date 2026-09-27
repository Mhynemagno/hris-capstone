import { OTHERS_CHOICE, PNP_GENERAL_REQUIREMENTS } from "@/lib/pnp-catalogue";
import type { JobQualificationCriterion } from "@/lib/types/database";
import type { GeneralRequirementsInput, JobCriterionInput } from "@/schemas/recruitment";

type SavedCriterion = Pick<JobQualificationCriterion, "kind" | "requirement" | "is_required" | "ordinal">;
type GeneralRequirementsValues = {
  education: { choice: string; other: string };
  eligibility: { choice: string; other: string };
  otherRequirements: Array<{ kind: JobCriterionInput["kind"]; requirement: string; included: boolean; isRequired: boolean }>;
};

const sameText = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

function byOrdinal<T extends { ordinal: number }>(criteria: readonly T[]) {
  return [...criteria].sort((left, right) => left.ordinal - right.ordinal);
}

/** A saved requirement shown in its dropdown: a listed value keeps the listed wording, anything else is its own choice. */
function savedChoice(choices: readonly string[], saved: string | undefined) {
  if (!saved) return "";
  return choices.find((choice) => choice !== OTHERS_CHOICE && sameText(choice, saved)) ?? saved;
}

/**
 * The job form's General Requirements for an opening. A new opening starts with every "Other
 * requirements" item checked. Older openings keep their saved criteria: the first education and
 * eligibility criteria fill the two dropdowns, and every other saved criterion stays in the
 * checklist (checked) so saving never drops it silently.
 */
export function generalRequirementsFromCriteria(criteria: readonly SavedCriterion[] = []): GeneralRequirementsValues {
  const sorted = byOrdinal(criteria);
  const education = sorted.find((criterion) => criterion.kind === "education");
  const eligibility = sorted.find((criterion) => criterion.kind === "eligibility");
  const rest = sorted.filter((criterion) => criterion !== education && criterion !== eligibility);
  const isNew = sorted.length === 0;
  const listed = PNP_GENERAL_REQUIREMENTS.other.map((requirement) => {
    const saved = rest.find((criterion) => sameText(criterion.requirement, requirement));
    return { kind: "other" as const, requirement, included: isNew || Boolean(saved), isRequired: saved?.is_required ?? true };
  });
  const unlisted = rest
    .filter((criterion) => !PNP_GENERAL_REQUIREMENTS.other.some((requirement) => sameText(criterion.requirement, requirement)))
    .map((criterion) => ({ kind: criterion.kind, requirement: criterion.requirement, included: true, isRequired: criterion.is_required }));
  return {
    education: { choice: savedChoice(PNP_GENERAL_REQUIREMENTS.education, education?.requirement), other: "" },
    eligibility: { choice: savedChoice(PNP_GENERAL_REQUIREMENTS.eligibility, eligibility?.requirement), other: "" },
    otherRequirements: [...listed, ...unlisted],
  };
}

/** The General Requirements as ordered job qualification criteria (Education, Eligibility, then the checked items). */
export function criteriaFromGeneralRequirements(requirements: GeneralRequirementsInput): JobCriterionInput[] {
  const chosen = (value: { choice: string; other: string }) => (value.choice === OTHERS_CHOICE ? value.other : value.choice).trim();
  const rows: Array<Omit<JobCriterionInput, "ordinal">> = [
    { kind: "education", requirement: chosen(requirements.education), isRequired: true },
    { kind: "eligibility", requirement: chosen(requirements.eligibility), isRequired: true },
    ...requirements.otherRequirements
      .filter((item) => item.included)
      .map((item) => ({ kind: item.kind, requirement: item.requirement.trim(), isRequired: item.isRequired })),
  ];
  return rows.map((row, index) => ({ ...row, ordinal: index + 1 }));
}

const kindLabels: Record<JobCriterionInput["kind"], string> = {
  education: "Education",
  eligibility: "Eligibility",
  experience: "Experience",
  skill: "Skill",
  certification: "Certification / Training",
  other: "Other",
};

/** Saved criteria grouped for display under "General Requirements". */
export function groupGeneralRequirements<T extends SavedCriterion>(criteria: readonly T[]) {
  const sorted = byOrdinal(criteria);
  return {
    education: sorted.filter((criterion) => criterion.kind === "education"),
    eligibility: sorted.filter((criterion) => criterion.kind === "eligibility"),
    // Older openings may carry experience, skill or certification criteria; they are listed with their type.
    others: sorted
      .filter((criterion) => criterion.kind !== "education" && criterion.kind !== "eligibility")
      .map((criterion) => ({ criterion, label: criterion.kind === "other" || !kindLabels[criterion.kind] ? criterion.requirement : `${kindLabels[criterion.kind]}: ${criterion.requirement}` })),
  };
}
