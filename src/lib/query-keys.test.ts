import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it("namespaces a role landing key with its role", () => {
    expect(queryKeys.roleLanding("management")).toEqual([
      "role-landing",
      "management",
    ]);
  });

  it("provides a stable key for app shell concerns", () => {
    expect(queryKeys.appShell()).toEqual(["app-shell"]);
  });

  it("scopes administration lists by their active filters", () => {
    expect(queryKeys.administration.users({ role: "applicant" })).toEqual([
      "administration",
      "users",
      { role: "applicant" },
    ]);
  });

  it("scopes HR application queues by their active filters", () => {
    const recruitment = queryKeys as typeof queryKeys & {
      recruitment: {
        applications: (filters: Record<string, unknown>) => readonly unknown[];
      };
    };

    expect(recruitment.recruitment).toBeDefined();
    expect(recruitment.recruitment.applications({ page: 1, pageSize: 20, status: "Submitted" })).toEqual([
      "recruitment",
      "applications",
      { page: 1, pageSize: 20, status: "Submitted" },
    ]);
  });

  it("scopes leave data by audience, request, and filters", () => {
    const leaveManagement = queryKeys as typeof queryKeys & {
      leaveManagement: {
        types: () => readonly unknown[];
        mine: (filters: Record<string, unknown>) => readonly unknown[];
        request: (requestId: string) => readonly unknown[];
        hrQueue: (filters: Record<string, unknown>) => readonly unknown[];
      };
    };

    expect(leaveManagement.leaveManagement.types()).toEqual(["leave-management", "types"]);
    expect(leaveManagement.leaveManagement.mine({ page: 1, pageSize: 20 })).toEqual([
      "leave-management", "mine", { page: 1, pageSize: 20 },
    ]);
    expect(leaveManagement.leaveManagement.request("123e4567-e89b-42d3-a456-426614174000")).toEqual([
      "leave-management", "request", "123e4567-e89b-42d3-a456-426614174000",
    ]);
    expect(leaveManagement.leaveManagement.hrQueue({ status: "pending" })).toEqual([
      "leave-management", "hr-queue", { status: "pending" },
    ]);
  });
});
