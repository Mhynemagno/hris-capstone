import { formatDate, formatDateTime } from "@/lib/format-date";
import type { AuditLog } from "@/lib/types/database";
import type { AppRole } from "@/lib/types/roles";

export type AuditPresentationLookups = {
  departments: Record<string, string>;
  ranks: Record<string, string>;
  profiles: Record<string, string>;
};

export type AuditDetailEntry = { label: string; value: string };

export type AuditLogDisplay = AuditLog & {
  actionLabel: string;
  actorLabel: string;
  details: Record<string, unknown>;
  detailEntries: AuditDetailEntry[];
  recordLabel: string;
  summary: string;
};

/**
 * The short action list administrators filter by. Each group maps the raw action codes written by
 * the audit trigger (insert/update/delete) and by the workflow RPCs (created, hired, approved, ...).
 */
export const AUDIT_ACTION_GROUPS = {
  created: { label: "Created", actions: ["insert", "created", "imported", "queued", "enrolled", "ai_retry_queued"] },
  updated: { label: "Updated", actions: ["update", "updated", "status_changed", "activation_changed", "activated", "deactivated", "resolved", "completed", "failed", "re_registered", "ai_scored"] },
  deleted: { label: "Deleted", actions: ["delete", "deleted"] },
  approved: { label: "Approved", actions: ["approved", "hired"] },
  rejected: { label: "Rejected", actions: ["rejected"] },
} as const;

export type AuditActionGroup = keyof typeof AUDIT_ACTION_GROUPS;
export const AUDIT_ACTION_GROUP_KEYS = Object.keys(AUDIT_ACTION_GROUPS) as [AuditActionGroup, ...AuditActionGroup[]];

export function auditActionGroup(action: string): AuditActionGroup | null {
  for (const key of AUDIT_ACTION_GROUP_KEYS) {
    if ((AUDIT_ACTION_GROUPS[key].actions as readonly string[]).includes(action)) return key;
  }
  return null;
}

const roleLabels: Record<AppRole, string> = {
  system_administrator: "System Administrator",
  hr_personnel: "HR Personnel",
  applicant: "Applicant",
  employee: "Employee",
  management: "Management",
};

const entityLabels: Record<string, string> = {
  applications: "Job application",
  attendance_imports: "Attendance import",
  attendance_integration_settings: "Attendance integration settings",
  attendance_logs: "Attendance log",
  attendance_unmatched_events: "Unmatched attendance event",
  deployments: "Deployment",
  employee_face_enrollments: "Face enrollment",
  employees: "Personnel record",
  job_openings: "Job opening",
  leave_requests: "Leave request",
  leave_types: "Leave type",
  performance_ratings: "Performance rating",
  profile_change_requests: "Profile change request",
  promotion_criteria: "Promotion criteria",
  promotion_evaluations: "Promotion evaluation",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function displayRole(value: unknown) {
  return typeof value === "string" && value in roleLabels
    ? roleLabels[value as AppRole]
    : "the selected role";
}

function quoted(label: string, value: string) {
  return `${label} “${value}”`;
}

/** Short, non-opaque reference for records without a name: "#42" or "#cf77c8cd" for UUIDs. */
function shortId(id: string) {
  return `#${uuidPattern.test(id) ? id.slice(0, 8) : id}`;
}

function resourceLabel(log: AuditLog, lookups: AuditPresentationLookups) {
  const metadata = log.metadata;
  switch (log.entity_type) {
    case "departments": {
      const departmentName = textValue(metadata.name) ?? lookups.departments[log.entity_id];
      return departmentName ? quoted("Unit / Section", departmentName) : `Unit / Section ${shortId(log.entity_id)}`;
    }
    case "ranks": {
      const rankName = textValue(metadata.name) ?? lookups.ranks[log.entity_id];
      return rankName ? quoted("Rank", rankName) : `Rank ${shortId(log.entity_id)}`;
    }
    case "unit_stations": {
      const stationName = textValue(metadata.name);
      return stationName ? quoted("Unit", stationName) : `Unit ${shortId(log.entity_id)}`;
    }
    case "profiles":
    case "user_roles": {
      const accountId = textValue(metadata.user_id) ?? log.entity_id;
      const accountLabel = textValue(metadata.full_name) ?? textValue(metadata.email) ?? lookups.profiles[accountId];
      return accountLabel ? quoted("Account", accountLabel) : log.action === "delete" ? "Deleted account" : "Account (no longer available)";
    }
    case "applicants": {
      const applicantName = textValue(metadata.full_name) ?? lookups.profiles[textValue(metadata.user_id) ?? ""];
      return applicantName ? quoted("Applicant", applicantName) : `Applicant profile ${shortId(log.entity_id)}`;
    }
    case "organization_settings":
      return "Organization settings";
    default: {
      const label = entityLabels[log.entity_type] ?? humanize(log.entity_type);
      return `${label} ${shortId(log.entity_id)}`;
    }
  }
}

const fieldLabels: Record<string, string> = {
  full_name: "Name",
  is_active: "Active",
  previous_is_active: "Previously active",
  removed: "Also removed",
  sort_order: "Order",
  created_at: "Created",
  updated_at: "Last updated",
  assigned_at: "Assigned",
};

function humanize(key: string) {
  if (fieldLabels[key]) return fieldLabels[key];
  const words = key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim();
  return words.replace(/^./, (letter) => letter.toUpperCase()).replace(/\bid\b/g, "ID").replace(/\bai\b/gi, "AI");
}

function actionWord(action: string) {
  const group = auditActionGroup(action);
  return group ? AUDIT_ACTION_GROUPS[group].label : humanize(action);
}

/** A date-only value in words ("September 15, 2026"); a timestamp with its Philippine time. */
function formatAuditValueDate(value: string) {
  return (/^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : formatDateTime(value)) ?? value;
}

/** "September 15, 2026" — the audit table's date column. */
export function formatAuditDate(value: string) {
  return formatDate(value) ?? value;
}

function formatValue(key: string, value: unknown, lookups: AuditPresentationLookups): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (key === "role" && value in roleLabels) return roleLabels[value as AppRole];
    if (uuidPattern.test(value) && lookups.profiles[value]) return lookups.profiles[value];
    if (isoDatePattern.test(value)) return formatAuditValueDate(value);
    return value;
  }
  if (Array.isArray(value)) {
    if (!value.length) return "None";
    // Deletion summaries: [{ label: "notifications", count: 2 }, ...]
    if (value.every((item) => typeof item === "object" && item !== null && "label" in item && "count" in item)) {
      return value.map((item) => `${(item as { count: unknown }).count} ${(item as { label: unknown }).label}`).join(", ");
    }
    return value.map((item) => formatValue(key, item, lookups)).join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return "—";
    return entries.map(([nestedKey, nestedValue]) => `${humanize(nestedKey)}: ${formatValue(nestedKey, nestedValue, lookups)}`).join("; ");
  }
  return String(value);
}

/** Readable label/value pairs for the details dialog; named fields first, identifiers last. */
export function auditDetailEntries(details: Record<string, unknown>, lookups: AuditPresentationLookups = { departments: {}, ranks: {}, profiles: {} }): AuditDetailEntry[] {
  const isIdentifier = (key: string) => key === "id" || key.endsWith("_id");
  return Object.entries(details)
    .sort(([a], [b]) => Number(isIdentifier(a)) - Number(isIdentifier(b)))
    .map(([key, value]) => ({ label: humanize(key), value: formatValue(key, value, lookups) }));
}

export function presentAuditLog(log: AuditLog, lookups: AuditPresentationLookups): AuditLogDisplay {
  const recordLabel = resourceLabel(log, lookups);
  const actorLabel = log.actor_user_id ? lookups.profiles[log.actor_user_id] ?? "Unknown account" : "System";
  const actionLabel = actionWord(log.action);
  let summary = `${recordLabel} ${actionLabel.toLowerCase()}`;

  if (log.entity_type === "user_roles" && log.action === "update" && textValue(log.metadata.role)) {
    summary = `${recordLabel}: role changed to ${displayRole(log.metadata.role)}`;
  }

  if (log.entity_type === "profiles" && log.action === "activation_changed") {
    summary = log.metadata.is_active === true ? `${recordLabel} can sign in again` : `${recordLabel} can no longer sign in`;
  }

  return {
    ...log,
    actorLabel,
    recordLabel,
    actionLabel,
    summary,
    details: log.metadata,
    detailEntries: auditDetailEntries(log.metadata, lookups),
  };
}
