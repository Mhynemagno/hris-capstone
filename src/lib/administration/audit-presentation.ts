import type { AuditLog } from "@/lib/types/database";
import type { AppRole } from "@/lib/types/roles";

export type AuditPresentationLookups = {
  departments: Record<string, string>;
  positions: Record<string, string>;
  profiles: Record<string, string>;
};

export type AuditLogDisplay = AuditLog & {
  actionLabel: string;
  actorLabel: string;
  details: Record<string, unknown>;
  recordLabel: string;
  summary: string;
};

const roleLabels: Record<AppRole, string> = {
  system_administrator: "System Administrator",
  hr_personnel: "HR Personnel",
  applicant: "Applicant",
  employee: "Employee",
  management: "Management",
};

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

function resourceLabel(log: AuditLog, lookups: AuditPresentationLookups) {
  const metadata = log.metadata;
  switch (log.entity_type) {
    case "departments":
      {
        const departmentName = textValue(metadata.name) ?? lookups.departments[log.entity_id];
        return departmentName ? quoted("Department", departmentName) : `Department #${log.entity_id}`;
      }
    case "positions": {
      const positionTitle = textValue(metadata.title) ?? lookups.positions[log.entity_id];
      return positionTitle ? quoted("Position", positionTitle) : `Position #${log.entity_id}`;
    }
    case "profiles":
    case "user_roles": {
      const accountId = textValue(metadata.user_id) ?? log.entity_id;
      const accountLabel = lookups.profiles[accountId];
      return accountLabel ? quoted("Account", accountLabel) : `Account #${accountId}`;
    }
    case "organization_settings":
      return "Organization settings";
    default:
      return `${log.entity_type.replaceAll("_", " ")} #${log.entity_id}`;
  }
}

function genericAction(action: string) {
  switch (action) {
    case "insert":
      return "Created";
    case "delete":
      return "Deleted";
    case "update":
      return "Updated";
    default:
      return action.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
  }
}

function summaryAction(actionLabel: string) {
  return actionLabel.charAt(0).toLowerCase() + actionLabel.slice(1);
}

export function presentAuditLog(log: AuditLog, lookups: AuditPresentationLookups): AuditLogDisplay {
  const recordLabel = resourceLabel(log, lookups);
  const actorLabel = log.actor_user_id ? lookups.profiles[log.actor_user_id] ?? "Unknown account" : "System";
  let actionLabel = genericAction(log.action);
  let summary = `${recordLabel} ${summaryAction(actionLabel)}`;

  if (log.entity_type === "user_roles" && log.action === "update" && textValue(log.metadata.role)) {
    actionLabel = `Role changed to ${displayRole(log.metadata.role)}`;
    summary = `Account role changed to ${displayRole(log.metadata.role)}`;
  }

  if (log.entity_type === "profiles" && log.action === "activation_changed") {
    const active = log.metadata.is_active === true;
    actionLabel = active ? "Activated" : "Deactivated";
    summary = active ? "Account activated" : "Account deactivated";
  }

  return {
    ...log,
    actorLabel,
    recordLabel,
    actionLabel,
    summary,
    details: log.metadata,
  };
}
