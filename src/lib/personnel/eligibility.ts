import type { Qualification } from "@/lib/types/database";

/** An eligibility rating as a percent, e.g. 85 -> "85%", 82.5 -> "82.5%". */
export function formatRating(rating: number | string) {
  return `${Number(rating)}%`;
}

/** "NAPOLCOM PNP Entrance Examination — 85%"; just the name when no rating is recorded. */
export function eligibilityLabel(qualification: Pick<Qualification, "name" | "rating">) {
  return qualification.rating === null || qualification.rating === undefined
    ? qualification.name
    : `${qualification.name} — ${formatRating(qualification.rating)}`;
}
