import { describe, expect, it } from "vitest";

import type { AuditLog } from "@/lib/types/database";

import { presentAuditLog } from "./audit-presentation";

const actorId = "f988df5c-804b-47bf-a5ad-4d48387f5b21";
const targetId = "c038df5c-804b-47bf-a5ad-4d48387f5b21";

const lookups = {
  profiles: {
    [actorId]: "Chief Ada Lovelace",
    [targetId]: "Officer Grace Hopper",
  },
  departments: {},
  positions: {},
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
      recordLabel: "Department “Employees”",
      actionLabel: "Created",
      summary: "Department “Employees” created",
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
    expect(entry.actionLabel).toBe("Role changed to System Administrator");
    expect(entry.summary).toBe("Account role changed to System Administrator");
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
    expect(entry.actionLabel).toBe("Activated");
    expect(entry.summary).toBe("Account activated");
  });

  it("uses safe fallback labels when historical lookup data is unavailable", () => {
    const entry = presentAuditLog(auditLog({
      actor_user_id: null,
      entity_type: "positions",
      entity_id: "42",
      action: "update",
      metadata: {},
    }), { profiles: {}, departments: {}, positions: {} });

    expect(entry.recordLabel).toBe("Position #42");
    expect(entry.actionLabel).toBe("Updated");
    expect(entry.summary).toBe("Position #42 updated");
  });
});
