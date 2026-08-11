export const APP_ROLES = [
  "system_administrator",
  "hr_personnel",
  "applicant",
  "employee",
  "management",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
