import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useInviteInternalUser: vi.fn(),
  useAuditLogs: vi.fn(),
  useDepartments: vi.fn(),
  useManagedRoles: vi.fn(),
  useManagedUsers: vi.fn(),
  useOrganizationSettings: vi.fn(),
  usePositions: vi.fn(),
  useSaveDepartment: vi.fn(),
  useSaveOrganizationSettings: vi.fn(),
  useSavePosition: vi.fn(),
  useUpdateManagedUser: vi.fn(),
}));

vi.mock("@/hooks/use-administration", () => ({
  useAuditLogs: hooks.useAuditLogs,
  useDepartments: hooks.useDepartments,
  useInviteInternalUser: hooks.useInviteInternalUser,
  useManagedRoles: hooks.useManagedRoles,
  useManagedUsers: hooks.useManagedUsers,
  useOrganizationSettings: hooks.useOrganizationSettings,
  usePositions: hooks.usePositions,
  useSaveDepartment: hooks.useSaveDepartment,
  useSaveOrganizationSettings: hooks.useSaveOrganizationSettings,
  useSavePosition: hooks.useSavePosition,
  useUpdateManagedUser: hooks.useUpdateManagedUser,
}));

import { AdministrationFormPanel } from "./administration-form-panel";
import { AuditLogsWorkspace, DepartmentsWorkspace, UsersWorkspace } from "./administration-workspaces";
import { PaginatedTableControls } from "./paginated-table-controls";

describe("administration shared controls", () => {
  it("moves through a known 20-row page range", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginatedTableControls page={2} pageSize={20} totalCount={45} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("disables unavailable page changes", () => {
    render(<PaginatedTableControls page={1} pageSize={20} totalCount={10} onPageChange={() => undefined} />);

    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("provides an accessible form panel", () => {
    render(
      <AdministrationFormPanel open onOpenChange={() => undefined} title="Invite account" description="Send an account invitation.">
        <form><button type="submit">Send invitation</button></form>
      </AdministrationFormPanel>,
    );

    expect(screen.getByRole("heading", { name: "Invite account" })).toBeInTheDocument();
    expect(screen.getByText("Send an account invitation.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("shows a recoverable empty users state", () => {
    hooks.useManagedUsers.mockReturnValue({
      data: { rows: [], count: 0 },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    hooks.useInviteInternalUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    hooks.useUpdateManagedUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<UsersWorkspace />);

    expect(screen.getByText(/no accounts match/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invite account/i })).toBeInTheDocument();
  });

  it("keeps department deactivation non-destructive", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    hooks.useDepartments.mockReturnValue({ data: { rows: [{ id: 1, name: "Operations", is_active: true }], count: 1 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useSaveDepartment.mockReturnValue({ isPending: false, mutateAsync });

    render(<DepartmentsWorkspace />);
    await user.click(screen.getByRole("button", { name: /deactivate operations/i }));

    expect(mutateAsync).toHaveBeenCalledWith({ departmentId: 1, input: { name: "Operations", isActive: false } });
  });

  it("keeps a department row visible and reports a failed deactivation", async () => {
    const user = userEvent.setup();
    hooks.useDepartments.mockReturnValue({ data: { rows: [{ id: 1, name: "Operations", is_active: true }], count: 1 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useSaveDepartment.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockRejectedValue(new Error("Department is referenced")) });

    render(<DepartmentsWorkspace />);
    await user.click(screen.getByRole("button", { name: /deactivate operations/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Department is referenced");
    expect(screen.getByText("Operations")).toBeInTheDocument();
  });

  it("renders audit history without mutation controls", () => {
    hooks.useAuditLogs.mockReturnValue({ data: { rows: [], count: 0 }, error: null, isLoading: false, refetch: vi.fn() });

    render(<AuditLogsWorkspace />);

    expect(screen.getByText(/no audit entries match/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add|edit|delete/i })).not.toBeInTheDocument();
  });
});
