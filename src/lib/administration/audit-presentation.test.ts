import { describe, expect, it } from "vitest";

import type { AuditLog } from "@/lib/types/database";

import { AUDIT_ACTION_GROUPS, auditActionGroup, formatAuditDate, presentAuditLog } from "./audit-presentation";

const actorId = "f988df5c-804b-47bf-a5ad-4d48387f5b21";
const targetId = "c038df5c-804b-47bf-a5ad-4d48387f5b21";

const lookups = {
  profiles: {
    [actorId]: "Chief Ada Lovelace",
    [targetId]: "Officer Grace Hopper",
  },
  departments: {},
  ranks: {},
};

function auditLog(overrides: Partial<AuditLog>): AuditLog {
  return {
    id: 1,
    actor_user_id: actorId,
    entity_type: "departments",
    entity_id: "18",
    action: "insert",
    metadata: {},
    created_at: "2026-08-15T09:18:40.330063+00:00",
    ...overrides,
  };
}

describe("presentAuditLog", () => {
  it("turns a department insert into a readable record and action", () => {
    const entry = presentAuditLog(auditLog({ metadata: { id: 18, name: "Employees", is_active: true } }), lookups);

    expect(entry).toMatchObject({
      actorLabel: "Chief Ada Lovelace",
      recordLabel: "Unit / Section “Employees”",
      actionLabel: "Created",
      summary: "Unit / Section “Employees” created",
    });
    expect(entry.details).toEqual({ id: 18, name: "Employees", is_active: true });
  });

  it("describes account role changes without exposing an opaque UUID", () => {
    const entry = presentAuditLog(auditLog({
      entity_type: "user_roles",
      entity_id: targetId,
      action: "update",
      metadata: { user_id: targetId, role: "system_administrator" },
    }), lookups);

    expect(entry.recordLabel).toBe("Account “Officer Grace Hopper”");
    expect(entry.actionLabel).toBe("Updated");
    expect(entry.summary).toBe("Account “Officer Grace Hopper”: role changed to System Administrator");
    expect(entry.detailEntries).toEqual([
      { label: "Role", value: "System Administrator" },
      { label: "User ID", value: "Officer Grace Hopper" },
    ]);
  });

  it("uses a system actor and activation language for profile status history", () => {
    const entry = presentAuditLog(auditLog({
      actor_user_id: null,
      entity_type: "profiles",
      entity_id: targetId,
      action: "activation_changed",
      metadata: { is_active: true, previous_is_active: false },
    }), lookups);

    expect(entry.actorLabel).toBe("System");
    expect(entry.recordLabel).toBe("Account “Officer Grace Hopper”");
    expect(entry.actionLabel).toBe("Updated");
    expect(entry.summary).toBe("Account “Officer Grace Hopper” can sign in again");
    expect(entry.detailEntries).toEqual([
      { label: "Active", value: "Yes" },
      { label: "Previously active", value: "No" },
    ]);
  });

  it("uses safe fallback labels when historical lookup data is unavailable", () => {
    const entry = presentAuditLog(auditLog({
      actor_user_id: null,
      entity_type: "ranks",
      entity_id: "42",
      action: "update",
      metadata: {},
    }), { profiles: {}, departments: {}, ranks: {} });

    expect(entry.recordLabel).toBe("Rank #42");
    expect(entry.actionLabel).toBe("Updated");
    expect(entry.summary).toBe("Rank #42 updated");
  });

  it("names a deleted account from its deletion entry instead of a raw UUID", () => {
    const entry = presentAuditLog(auditLog({
      entity_type: "user_roles",
      entity_id: "cf77c8cd-0000-4000-8000-000000000000",
      action: "delete",
      metadata: { user_id: "cf77c8cd-0000-4000-8000-000000000000", role: "applicant" },
    }), { profiles: { [actorId]: "Chief Ada Lovelace" }, departments: {}, ranks: {} });

    expect(entry.recordLabel).toBe("Deleted account");
    expect(entry.summary).not.toContain("cf77c8cd");
  });

  it("formats deletion summaries and dates as readable values", () => {
    const entry = presentAuditLog(auditLog({
      entity_type: "profiles",
      entity_id: targetId,
      action: "delete",
      metadata: { full_name: "Fernando Allen", removed: [{ label: "job applications", count: 2 }], created_at: "2026-09-15T08:00:00+00:00" },
    }), lookups);

    expect(entry.recordLabel).toBe("Account “Fernando Allen”");
    expect(entry.actionLabel).toBe("Deleted");
    expect(entry.detailEntries).toContainEqual({ label: "Name", value: "Fernando Allen" });
    expect(entry.detailEntries).toContainEqual({ label: "Also removed", value: "2 job applications" });
    expect(entry.detailEntries.find((item) => item.label === "Created")?.value).toMatch(/^September 15, 2026/);
  });

  it("groups raw action codes into the short filter list", () => {
    expect(auditActionGroup("insert")).toBe("created");
    expect(auditActionGroup("hired")).toBe("approved");
    expect(auditActionGroup("rejected")).toBe("rejected");
    expect(auditActionGroup("delete")).toBe("deleted");
    expect(auditActionGroup("activation_changed")).toBe("updated");
    expect(Object.values(AUDIT_ACTION_GROUPS).map((group) => group.label)).toEqual(["Created", "Updated", "Deleted", "Approved", "Rejected"]);
  });

  it("formats the table date without a time", () => {
    expect(formatAuditDate("2026-09-15T12:00:00Z")).toBe("September 15, 2026");
  });

  it("names announcements and public contacts from their audit metadata", () => {
    expect(presentAuditLog(auditLog({ entity_type: "announcements", entity_id: targetId, action: "status_changed", metadata: { title: "Road closure", from: "draft", to: "published" } }), lookups).recordLabel).toBe("Announcement “Road closure”");
    expect(presentAuditLog(auditLog({ entity_type: "public_contacts", entity_id: targetId, action: "created", metadata: { label: "HR Office" } }), lookups).summary).toBe("Public contact “HR Office” created");
    expect(presentAuditLog(auditLog({ entity_type: "public_contacts", entity_id: "all", action: "updated", metadata: { reordered: true, count: 3 } }), lookups).recordLabel).toBe("Public contact order");
  });
});
