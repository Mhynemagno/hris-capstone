/**
 * The client's performance rubric (round 5, 2026-10-10). Mirrors private.performance_rubric in
 * supabase/migrations/20261010100001_performance_rubric.sql, which is the authority when an evaluation is saved;
 * this copy previews the score on screen.
 */

export type CourseCategory = "mandatory_course" | "specialized_training";

/** Points for completed years of service, out of 50. */
export const SERVICE_POINT_BANDS = [
  { label: "Less than 1 year", minimum: 0, points: 5 },
  { label: "1–3 years", minimum: 1, points: 15 },
  { label: "4–6 years", minimum: 4, points: 25 },
  { label: "7–9 years", minimum: 7, points: 35 },
  { label: "10–14 years", minimum: 10, points: 45 },
  { label: "15 years and above", minimum: 15, points: 50 },
] as const;

/** Points per distinct completed course and the cap for each category. */
export const COURSE_POINTS = {
  mandatory_course: { label: "Mandatory Career Course", perCourse: 15, cap: 30 },
  specialized_training: { label: "Specialized Unit Training", perCourse: 10, cap: 20 },
} as const;

/** Total points → grade equivalent and descriptive rating; ratingValue is the 1–5 value promotion criteria use. */
export const GRADE_SCALE = [
  { label: "90 – 100", minimum: 90, grade: "1.00", rating: "Outstanding", ratingValue: 5, remarks: "Qualified for Promotion / Next Rank" },
  { label: "80 – 89", minimum: 80, grade: "1.50", rating: "Very Satisfactory", ratingValue: 4, remarks: "Qualified for Promotion / Next Rank" },
  { label: "70 – 79", minimum: 70, grade: "2.00", rating: "Satisfactory", ratingValue: 3, remarks: "Meets Standard Requirements" },
  { label: "60 – 69", minimum: 60, grade: "2.50", rating: "Unsatisfactory", ratingValue: 2, remarks: "For Training Enhancement / Re-evaluation" },
  { label: "Below 60", minimum: 0, grade: "3.00", rating: "Poor", ratingValue: 1, remarks: "Below Passing Criteria / Under Review" },
] as const;

export function servicePoints(years: number) {
  return [...SERVICE_POINT_BANDS].reverse().find((band) => years >= band.minimum)?.points ?? 5;
}

export function gradeForTotal(total: number) {
  return GRADE_SCALE.find((band) => total >= band.minimum) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

/** Completed whole years between two ISO dates. */
export function completedYears(startedOn: string, asOf: string) {
  const [startYear, startMonth, startDay] = startedOn.split("-").map(Number);
  const [endYear, endMonth, endDay] = asOf.split("-").map(Number);
  const years = endYear - startYear - (endMonth < startMonth || (endMonth === startMonth && endDay < startDay) ? 1 : 0);
  return Math.max(years, 0);
}

type RubricCertification = { name: string; category: CourseCategory | null; expires_on: string | null; issued_on?: string | null };

/** One course under its old and new names counts once (mirrors private.certification_course_key). */
function courseKey(name: string) {
  const key = name.trim().toLowerCase();
  return key === "criminal investigation course" ? "criminal investigation course (cic) / soco" : key;
}

export function computePerformanceRubric({ employmentStartedOn, asOf, certifications }: { employmentStartedOn: string; asOf: string; certifications: readonly RubricCertification[] }) {
  const yearsOfService = completedYears(employmentStartedOn, asOf);
  const valid = certifications.filter((course) => course.category && (!course.issued_on || course.issued_on <= asOf) && (!course.expires_on || course.expires_on >= asOf));
  const distinct = (category: CourseCategory) => new Set(valid.filter((course) => course.category === category).map((course) => courseKey(course.name))).size;
  const mandatoryCount = distinct("mandatory_course");
  const specializedCount = distinct("specialized_training");
  const mandatoryPoints = Math.min(mandatoryCount * COURSE_POINTS.mandatory_course.perCourse, COURSE_POINTS.mandatory_course.cap);
  const specializedPoints = Math.min(specializedCount * COURSE_POINTS.specialized_training.perCourse, COURSE_POINTS.specialized_training.cap);
  const service = servicePoints(yearsOfService);
  const totalPoints = service + mandatoryPoints + specializedPoints;
  const band = gradeForTotal(totalPoints);
  return {
    yearsOfService,
    servicePoints: service,
    mandatoryCount,
    mandatoryPoints,
    specializedCount,
    specializedPoints,
    totalPoints,
    grade: band.grade,
    rating: band.rating,
    ratingValue: band.ratingValue,
    remarks: band.remarks,
  };
}
