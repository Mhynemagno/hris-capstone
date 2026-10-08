import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/departments",
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

beforeEach(() => { navigation.replace.mockReset(); navigation.search = ""; });

const hooks = vi.hoisted(() => ({
  useDeleteManagedUser: vi.fn().mockReturnValue({ isPending: false, mutateAsync: vi.fn() }),
  useInviteInternalUser: vi.fn(),
  useAuditLogs: vi.fn(),
  useDepartmentOptions: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useDepartments: vi.fn(),
  useManagedRoles: vi.fn(),
  useManagedUsers: vi.fn(),
  useOrganizationSettings: vi.fn(),
  useRanks: vi.fn(),
  useSaveDepartment: vi.fn(),
  useSaveOrganizationSettings: vi.fn(),
  useSaveRank: vi.fn(),
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
  useRanks: hooks.useRanks,
  useSaveDepartment: hooks.useSaveDepartment,
  useSaveOrganizationSettings: hooks.useSaveOrganizationSettings,
  useSaveRank: hooks.useSaveRank,
  useUpdateManagedUser: hooks.useUpdateManagedUser,
}));

const deletion = vi.hoisted(() => ({
  useDeletionImpact: vi.fn().mockReturnValue({ data: undefined, error: null, isLoading: false, refetch: vi.fn() }),
  useDeleteRecord: vi.fn().mockReturnValue({ error: null, isPending: false, mutateAsync: vi.fn(), reset: vi.fn() }),
}));

vi.mock("@/hooks/use-deletion", () => deletion);

import { AdministrationFormPanel } from "./administration-form-panel";
import { AuditLogsWorkspace, DepartmentsWorkspace, RanksWorkspace, SettingsWorkspace, UsersWorkspace } from "./administration-workspaces";
import { PaginatedTableControls } from "./paginated-table-controls";

describe("administration shared controls", () => {
  it("moves through a known 10-row page range", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginatedTableControls page={2} pageSize={10} totalCount={45} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByText("11–20 of 45 records")).toBeInTheDocument();
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

  it("offers only Edit for departments and keeps the current status when an edit is saved", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    hooks.useDepartments.mockReturnValue({ data: { rows: [{ id: 1, name: "Operations", is_active: false }], count: 1 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useSaveDepartment.mockReturnValue({ isPending: false, mutateAsync });

    render(<DepartmentsWorkspace />);
    expect(screen.queryByRole("button", { name: /deactivate|activate/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Operations" }));
    expect(screen.getByRole("dialog", { name: "Edit unit / section" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^name/i));
    await user.type(screen.getByLabelText(/^name/i), "Operations Section");
    await user.click(screen.getByRole("button", { name: /save unit \/ section/i }));

    expect(mutateAsync).toHaveBeenCalledWith({ departmentId: 1, input: { name: "Operations Section", isActive: false } });
  });

  it("keeps the search box and results on screen while a search is typed", async () => {
    const user = userEvent.setup();
    hooks.useDepartments.mockReset();
    hooks.useDepartments.mockReturnValue({ data: { rows: [{ id: 1, name: "Operations", is_active: true }], count: 1 }, error: null, isFetching: true, isLoading: false, refetch: vi.fn() });
    hooks.useSaveDepartment.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<DepartmentsWorkspace />);
    const search = screen.getByRole("searchbox", { name: "Search units / sections" });
    await user.type(search, "Oper");

    expect(search).toHaveValue("Oper");
    expect(search).toHaveFocus();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    await waitFor(() => expect(hooks.useDepartments).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Oper", page: 1 })));
    // The query only follows the pause in typing, not every keystroke.
    expect(hooks.useDepartments.mock.calls.some(([filters]) => filters.search === "Op")).toBe(false);
  });

  it("writes administration filters to the URL and resets pagination", async () => {
    const user = userEvent.setup();
    navigation.search = "page=3";
    hooks.useDepartments.mockReturnValue({ data: { rows: [], count: 0 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useSaveDepartment.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<DepartmentsWorkspace />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter units / sections by status" }), "inactive");

    expect(navigation.replace).toHaveBeenCalledWith("/admin/departments?status=inactive", { scroll: false });
  });

  it("shows the first load inside the table area so the search box stays usable", () => {
    hooks.useManagedUsers.mockReturnValue({ data: undefined, error: null, isLoading: true, refetch: vi.fn() });
    hooks.useInviteInternalUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    hooks.useUpdateManagedUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<UsersWorkspace />);

    expect(screen.getByRole("searchbox", { name: "Search accounts" })).toBeInTheDocument();
    expect(screen.getByText("Loading accounts…")).toBeInTheDocument();
  });

  it("offers Edit and Delete for accounts, with sign-in blocked from the edit form", async () => {
    const user = userEvent.setup();
    hooks.useManagedUsers.mockReturnValue({ data: { rows: [{ id: "00000000-0000-0000-0000-000000000002", email: "fernando@example.com", full_name: "Fernando Allen", is_active: true, role: "applicant", assigned_at: "2026-08-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" }], count: 1 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useInviteInternalUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    hooks.useUpdateManagedUser.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<UsersWorkspace />);

    expect(screen.queryByRole("button", { name: /deactivate/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/blocks sign-in/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Fernando Allen" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Fernando Allen" }));
    expect(screen.getByRole("checkbox", { name: "Account can sign in" })).toBeChecked();
  });

  it("renders audit history without mutation controls", () => {
    hooks.useAuditLogs.mockReturnValue({ data: { rows: [], count: 0 }, error: null, isLoading: false, refetch: vi.fn() });

    render(<AuditLogsWorkspace />);

    expect(screen.getByText(/no audit entries have been recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add|edit|delete/i })).not.toBeInTheDocument();
  });

  it("renders the audit table as Date, Account, Logs, Action, Details with a readable details dialog", async () => {
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
          created_at: "2026-09-15T09:18:40.330063+00:00",
          actorLabel: "Chief Ada Lovelace",
          recordLabel: "Account “Officer Grace Hopper”",
          actionLabel: "Updated",
          summary: "Account “Officer Grace Hopper”: role changed to System Administrator",
          details: { user_id: "c038df5c-804b-47bf-a5ad-4d48387f5b21", role: "system_administrator" },
          detailEntries: [{ label: "Role", value: "System Administrator" }, { label: "User ID", value: "Officer Grace Hopper" }],
        }],
        count: 1,
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<AuditLogsWorkspace />);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Date", "Account", "Logs", "Action", "Details"]);
    expect(screen.getByText("September 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("Chief Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Account “Officer Grace Hopper”")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Action" })).toHaveTextContent("All actionsCreatedUpdatedDeletedApprovedRejected");

    await user.click(screen.getByRole("button", { name: /view details for audit record 1/i }));
    const dialog = screen.getByRole("dialog", { name: /audit record details/i });
    expect(dialog).toHaveTextContent("System Administrator");
    expect(dialog).not.toHaveTextContent("system_administrator");
    expect(dialog).not.toHaveTextContent("{");
  });

  it("lists ranks by code and name with a delete action", () => {
    hooks.useRanks.mockReturnValue({
      data: { rows: [{ id: 1, name: "Patrolman / Patrolwoman", code: "Pat", sort_order: 1, is_active: true, created_at: "", updated_at: "" }], count: 1 },
      error: null, isLoading: false, refetch: vi.fn(),
    });
    hooks.useSaveRank.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<RanksWorkspace />);

    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Pat" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Patrolman / Patrolwoman" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Patrolman / Patrolwoman" })).toBeInTheDocument();
  });

  it("saves a rank with its name, code, and seniority order", async () => {
    const user = userEvent.setup();
    const saveRank = vi.fn().mockResolvedValue(undefined);
    hooks.useRanks.mockReturnValue({ data: { rows: [], count: 0 }, error: null, isLoading: false, refetch: vi.fn() });
    hooks.useSaveRank.mockReturnValue({ isPending: false, mutateAsync: saveRank });

    render(<RanksWorkspace />);
    await user.click(screen.getByRole("button", { name: "Add rank" }));
    await user.type(screen.getByLabelText(/^name/i), "Police Corporal");
    await user.type(screen.getByLabelText(/^code/i), "PCpl");
    await user.clear(screen.getByLabelText(/^order/i));
    await user.type(screen.getByLabelText(/^order/i), "2");
    await user.click(screen.getByRole("button", { name: /save rank/i }));

    expect(saveRank).toHaveBeenCalledWith({ input: { name: "Police Corporal", code: "PCpl", sortOrder: 2, isActive: true }, rankId: undefined });
  });
});
