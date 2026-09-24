import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useDeleteManagedUser: vi.fn().mockReturnValue({ isPending: false, mutateAsync: vi.fn() }),
  useInviteInternalUser: vi.fn(),
  useAuditLogs: vi.fn(),
  useDepartmentOptions: vi.fn().mockReturnValue({ data: [], isLoading: false }),
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
  useDeleteManagedUser: hooks.useDeleteManagedUser,
  useAuditLogs: hooks.useAuditLogs,
  useDepartmentOptions: hooks.useDepartmentOptions,
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

const deletion = vi.hoisted(() => ({
  useDeletionImpact: vi.fn().mockReturnValue({ data: undefined, error: null, isLoading: false, refetch: vi.fn() }),
  useDeleteRecord: vi.fn().mockReturnValue({ error: null, isPending: false, mutateAsync: vi.fn(), reset: vi.fn() }),
}));

vi.mock("@/hooks/use-deletion", () => deletion);

import { AdministrationFormPanel } from "./administration-form-panel";
import { AuditLogsWorkspace, DepartmentsWorkspace, SettingsWorkspace, UsersWorkspace } from "./administration-workspaces";
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
    expect(screen.getByRole("button", { name: /invite account/i })).toHaveClass("w-full", "sm:w-auto");
  });

  it("links a linked user account to its employee profile", () => {
    hooks.useManagedUsers.mockReturnValue({ data: { rows: [{ id: "00000000-0000-0000-0000-000000000001", email: "ada@example.com", full_name: "Officer Ada", is_active: true, role: "employee", assigned_at: "2026-08-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z", employee_id: "00000000-0000-0000-0000-000000000010" }], count: 1 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useInviteInternalUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    hooks.useUpdateManagedUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<UsersWorkspace />);

    expect(screen.getByRole("link", { name: /view profile for officer ada/i })).toHaveAttribute("href", "/admin/users/00000000-0000-0000-0000-000000000001/profile");
  });

  it("opens account invitations in a centered modal", async () => {
    const user = userEvent.setup();
    hooks.useManagedUsers.mockReturnValue({ data: { rows: [], count: 0 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useInviteInternalUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    hooks.useUpdateManagedUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<UsersWorkspace />);
    await user.click(screen.getByRole("button", { name: /invite account/i }));

    expect(screen.getByRole("dialog", { name: "Invite account" })).toHaveAttribute("data-side", "center");
  });

  it("collects first and last names when inviting an account", async () => {
    const user = userEvent.setup();
    hooks.useManagedUsers.mockReturnValue({ data: { rows: [], count: 0 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useInviteInternalUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    hooks.useUpdateManagedUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<UsersWorkspace />);
    await user.click(screen.getByRole("button", { name: /invite account/i }));

    expect(screen.getByRole("textbox", { name: "First name" })).toHaveAttribute("autocomplete", "given-name");
    expect(screen.getByRole("textbox", { name: "Last name" })).toHaveAttribute("autocomplete", "family-name");
    expect(screen.queryByRole("textbox", { name: "Full name" })).not.toBeInTheDocument();
  });

  it("keeps organization settings read-only until its edit modal opens", async () => {
    const user = userEvent.setup();
    hooks.useOrganizationSettings.mockReturnValue({
      data: { organization_name: "San Juan City Police", support_email: "hr@sanjuancity.gov", default_timezone: "Asia/Manila" },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    hooks.useSaveOrganizationSettings.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<SettingsWorkspace />);

    expect(screen.getByText("San Juan City Police")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit organization settings/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Organization name" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit organization settings/i }));
    expect(screen.getByRole("dialog", { name: /organization settings/i })).toHaveAttribute("data-side", "center");
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

    expect(screen.getByText(/no audit entries have been recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add|edit|delete/i })).not.toBeInTheDocument();
  });

  it("renders human-readable audit history and exposes structured details in a modal", async () => {
    const user = userEvent.setup();
    hooks.useAuditLogs.mockReturnValue({
      data: {
        rows: [{
          id: 1,
          actor_user_id: "f988df5c-804b-47bf-a5ad-4d48387f5b21",
          entity_type: "user_roles",
          entity_id: "c038df5c-804b-47bf-a5ad-4d48387f5b21",
          action: "update",
          metadata: { user_id: "c038df5c-804b-47bf-a5ad-4d48387f5b21", role: "system_administrator" },
          created_at: "2026-08-15T09:18:40.330063+00:00",
          actorLabel: "Chief Ada Lovelace",
          recordLabel: "Account “Officer Grace Hopper”",
          actionLabel: "Role changed to System Administrator",
          summary: "Account role changed to System Administrator",
          details: { user_id: "c038df5c-804b-47bf-a5ad-4d48387f5b21", role: "system_administrator" },
        }],
        count: 1,
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<AuditLogsWorkspace />);

    expect(screen.getByText("Chief Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Account “Officer Grace Hopper”")).toBeInTheDocument();
    expect(screen.getByText("Role changed to System Administrator")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view details for audit record 1/i }));
    expect(screen.getByRole("dialog", { name: /audit record details/i })).toHaveTextContent("system_administrator");
  });

  it("separates deactivation from deletion and explains a blocked delete with dependent counts", async () => {
    const user = userEvent.setup();
    const saveDepartment = vi.fn().mockResolvedValue(undefined);
    const deleteMutation = { isPending: false, error: null, mutateAsync: vi.fn(), reset: vi.fn() };
    hooks.useDepartments.mockReturnValue({ data: { rows: [{ id: 7, name: "Operations", is_active: true }], count: 1 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useSaveDepartment.mockReturnValue({ isPending: false, mutateAsync: saveDepartment });
    deletion.useDeleteRecord.mockReturnValue(deleteMutation);
    deletion.useDeletionImpact.mockImplementation((_type: string, id: number | null) => ({
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      data: id === null ? undefined : {
        entityType: "department", entityId: "7", label: "Operations", canDelete: false,
        blockers: [{ label: "personnel records", count: 12 }, { label: "positions", count: 3 }],
        reasons: [], removes: [],
        alternative: "Deactivate the department to hide it from new records while keeping history intact.",
      },
    }));

    render(<DepartmentsWorkspace />);
    expect(screen.getByRole("button", { name: /deactivate operations/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete operations/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("This department can't be deleted");
    expect(dialog).toHaveTextContent("12 personnel records");
    expect(dialog).toHaveTextContent("3 positions");
    expect(screen.getByRole("button", { name: "Delete department" })).toBeDisabled();
    expect(deleteMutation.mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Deactivate instead" }));
    expect(saveDepartment).toHaveBeenCalledWith({ departmentId: 7, input: { name: "Operations", isActive: false } });
  });

  it("deletes an unreferenced department only after confirmation", async () => {
    const user = userEvent.setup();
    const deleteMutation = { isPending: false, error: null, mutateAsync: vi.fn().mockResolvedValue(undefined), reset: vi.fn() };
    hooks.useDepartments.mockReturnValue({ data: { rows: [{ id: 8, name: "Legacy", is_active: false }], count: 1 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useSaveDepartment.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    deletion.useDeleteRecord.mockReturnValue(deleteMutation);
    deletion.useDeletionImpact.mockImplementation((_type: string, id: number | null) => ({
      isLoading: false, error: null, refetch: vi.fn(),
      data: id === null ? undefined : { entityType: "department", entityId: "8", label: "Legacy", canDelete: true, blockers: [], reasons: [], removes: [], alternative: null },
    }));

    render(<DepartmentsWorkspace />);
    await user.click(screen.getByRole("button", { name: /delete legacy/i }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("permanently removes");
    expect(deleteMutation.mutateAsync).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete department" }));

    expect(deleteMutation.mutateAsync).toHaveBeenCalledWith(8);
    expect(await screen.findByRole("status")).toHaveTextContent("permanently deleted");
  });
});
