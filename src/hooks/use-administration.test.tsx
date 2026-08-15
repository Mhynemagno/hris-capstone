import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const testUserId = "123e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  listManagedUsers: vi.fn(),
  updateManagedUser: vi.fn(),
}));

vi.mock("@/queries/administration", () => ({
  getOrganizationSettings: vi.fn(),
  inviteInternalUser: vi.fn(),
  listAuditLogs: vi.fn(),
  listDepartments: vi.fn(),
  listManagedUsers: mocks.listManagedUsers,
  listPositions: vi.fn(),
  saveDepartment: vi.fn(),
  saveOrganizationSettings: vi.fn(),
  savePosition: vi.fn(),
  updateManagedUser: mocks.updateManagedUser,
}));

import { useManagedRoles, useUpdateManagedUser } from "./use-administration";

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("administration hooks", () => {
  it("refreshes user, role, and audit pages after a role or activation change", async () => {
    mocks.updateManagedUser.mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateManagedUser(), { wrapper: createWrapper(queryClient) });

    await result.current.mutateAsync({
      input: { userId: testUserId, role: "employee", isActive: false },
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "users"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "roles"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "audit-logs"] });
  });

  it("uses the role cache family with a normalized 20-row filter", async () => {
    mocks.listManagedUsers.mockResolvedValue({ rows: [], count: 0, filters: { page: 1, pageSize: 20, role: "employee" } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useManagedRoles({ role: "employee" }), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(["administration", "roles", { page: 1, pageSize: 20, role: "employee" }])).toBeTruthy();
    expect(mocks.listManagedUsers).toHaveBeenCalledWith({ page: 1, pageSize: 20, role: "employee" });
  });
});
