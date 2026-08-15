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
    expect(screen.getByRole("button", { name: /invite account/i })).toBeInTheDocument();
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

    expect(screen.getByText(/no audit entries match/i)).toBeInTheDocument();
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
});
