/**
 * Recruitment opens twice a year (Final Revisions PDF p. 15): Cycle 1 runs January–June and Cycle 2
 * July–December. An opening belongs to the cycle of its opening date (published date, or today for a
 * draft) and its deadline must fall within that cycle. The database assigns and enforces the same rule
 * (20261022140000_recruitment_cycles_and_applicant_resubmission.sql).
 */
export type RecruitmentCycle = { cycle: 1 | 2; year: number };

const MANILA = "Asia/Manila";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day of a date-only value or a timestamp, read in Philippine time. */
function manilaDay(value: string | Date) {
  if (typeof value === "string") {
    const day = DATE_ONLY.exec(value);
    if (day) return { year: Number(day[1]), month: Number(day[2]) };
  }
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA, year: "numeric", month: "2-digit" }).formatToParts(new Date(value));
  return { year: Number(parts.find((part) => part.type === "year")?.value), month: Number(parts.find((part) => part.type === "month")?.value) };
}

export function recruitmentCycleOf(value: string | Date): RecruitmentCycle {
  const { year, month } = manilaDay(value);
  return { cycle: month <= 6 ? 1 : 2, year };
}

/** The cycle an opening runs in: stored values when present, otherwise derived from its opening date. */
export function openingRecruitmentCycle(job: { recruitment_cycle?: number | null; recruitment_year?: number | null; published_at?: string | null }, today: Date = new Date()): RecruitmentCycle {
  if ((job.recruitment_cycle === 1 || job.recruitment_cycle === 2) && job.recruitment_year) return { cycle: job.recruitment_cycle, year: job.recruitment_year };
  return recruitmentCycleOf(job.published_at ?? today);
}

/** The last day of the cycle as YYYY-MM-DD: June 30 or December 31. */
export function recruitmentCycleEnd({ cycle, year }: RecruitmentCycle) {
  return cycle === 1 ? `${year}-06-30` : `${year}-12-31`;
}

export function recruitmentCycleMonths(cycle: 1 | 2) {
  return cycle === 1 ? "January–June" : "July–December";
}

/** "Cycle 1 · January–June 2026". */
export function formatRecruitmentCycle(value: RecruitmentCycle) {
  return `Cycle ${value.cycle} · ${recruitmentCycleMonths(value.cycle)} ${value.year}`;
}

/** True when a YYYY-MM-DD deadline falls on or before the end of the cycle. */
export function deadlineWithinCycle(closesOn: string, cycle: RecruitmentCycle) {
  return closesOn <= recruitmentCycleEnd(cycle);
}
