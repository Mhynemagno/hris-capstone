"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { AdministrationFormPanel } from "@/components/administration/administration-form-panel";
import { PaginatedTableControls } from "@/components/administration/paginated-table-controls";
import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { EmptyTableState } from "@/components/ui/empty-table-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import {
  useAuditLogs,
  useDepartments,
  useInviteInternalUser,
  useManagedUsers,
  useOrganizationSettings,
  useRanks,
  useSaveDepartment,
  useSaveUnitStation,
  useUnitStationCatalogue,
  useSaveOrganizationSettings,
  useSaveRank,
  useUpdateManagedUser,
} from "@/hooks/use-administration";
import type { AuditLogDisplay } from "@/lib/administration/audit-presentation";
import type { Department, ManagedUser, Rank, UnitStation } from "@/lib/types/database";
import { APP_ROLES, type AppRole } from "@/lib/types/roles";
import { cn } from "@/lib/utils";
import {
  departmentSchema,
  unitStationSchema,
  internalInvitationSchema,
  managedUserUpdateSchema,
  organizationSettingsSchema,
  rankSchema,
  type DepartmentInput,
  type UnitStationInput,
  type InternalInvitationInput,
  type ManagedUserUpdateInput,
  type OrganizationSettingsInput,
  type RankInput,
} from "@/schemas/administration";

const roleLabels: Record<AppRole, string> = {
  system_administrator: "System Administrator",
  hr_personnel: "HR Personnel",
  applicant: "Applicant",
  employee: "Employee",
  management: "Management",
};

type StatusFilter = "active" | "inactive" | "";

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function ErrorWithRetry({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <ErrorState message={error.message} />
      <Button onClick={onRetry} type="button" variant="outline">Retry</Button>
    </div>
  );
}

function SuccessMessage({ message }: { message: string | null }) {
  return (
    <p aria-live="polite" className={cn("text-sm font-medium text-emerald-700 dark:text-emerald-400", !message && "sr-only")} role="status">
      {message ?? ""}
    </p>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "secondary" : "outline"}>{active ? "Active" : "Inactive"}</Badge>;
}

function DataTable({ caption, children, columns, minWidth = "min-w-[640px]" }: { caption: string; children: ReactNode; columns: string[]; minWidth?: string }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border bg-card">
      <table className={cn("w-full text-left text-sm", minWidth)}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/60">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3 font-semibold text-muted-foreground" key={column} scope="col">
                {column === "Actions" ? <span className="sr-only">Actions</span> : column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RowActions({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-2">{children}</div></td>;
}

function StatusSelect({ label, onChange, value }: { label: string; onChange: (value: StatusFilter) => void; value: StatusFilter }) {
  return (
    <select aria-label={label} className={cn(nativeSelectClassName, "sm:w-48")} onChange={(event) => onChange(event.target.value as StatusFilter)} value={value}>
      <option value="">All statuses</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  );
}

function CheckboxField({ children, ...props }: ComponentProps<"input"> & { children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
      <input className="size-5 accent-primary" type="checkbox" {...props} />
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

function UserFilters({ onRoleChange, onSearchChange, onStatusChange, role, search, status }: {
  onRoleChange: (value: AppRole | "") => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  role: AppRole | "";
  search: string;
  status: StatusFilter;
}) {
  return (
    <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <Input aria-label="Search accounts" onChange={(event) => onSearchChange(event.target.value)} placeholder="Search name or email" type="search" value={search} />
      <select aria-label="Filter users by role" className={cn(nativeSelectClassName, "sm:w-52")} onChange={(event) => onRoleChange(event.target.value as AppRole | "")} value={role}>
        <option value="">All roles</option>
        {APP_ROLES.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
      </select>
      <StatusSelect label="Filter users by status" onChange={onStatusChange} value={status} />
    </div>
  );
}

function InvitationForm({ onSaved, pending }: { onSaved: (input: InternalInvitationInput) => Promise<void>; pending: boolean }) {
  const form = useForm<z.input<typeof internalInvitationSchema>, unknown, InternalInvitationInput>({
    resolver: zodResolver(internalInvitationSchema),
    defaultValues: { email: "", firstName: "", lastName: "", role: "employee" },
  });
  const [error, setError] = useState<string | null>(null);
  const errors = form.formState.errors;

  async function submit(values: InternalInvitationInput) {
    setError(null);
    try {
      await onSaved(values);
      form.reset();
    } catch (cause) {
      setError(errorMessage(cause, "We could not send the invitation."));
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField error={errors.firstName?.message} htmlFor="invite-first-name" label="First name" required>
          <Input autoComplete="given-name" id="invite-first-name" {...form.register("firstName")} />
        </FormField>
        <FormField error={errors.lastName?.message} htmlFor="invite-last-name" label="Last name" required>
          <Input autoComplete="family-name" id="invite-last-name" {...form.register("lastName")} />
        </FormField>
      </div>
      <FormField error={errors.email?.message} htmlFor="invite-email" label="Email" required>
        <Input autoComplete="email" id="invite-email" type="email" {...form.register("email")} />
      </FormField>
      <FormField description="Applicants register themselves from the public careers page." error={errors.role?.message} htmlFor="invite-role" label="Role" required>
        <select className={nativeSelectClassName} id="invite-role" {...form.register("role")}>
          {APP_ROLES.filter((role) => role !== "applicant").map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
        </select>
      </FormField>
      {error ? <ErrorState message={error} /> : null}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Sending…" : "Send invitation"}</Button>
    </form>
  );
}

function ManagedUserForm({ onSaved, pending, user }: { onSaved: (input: ManagedUserUpdateInput) => Promise<void>; pending: boolean; user: ManagedUser }) {
  const form = useForm<ManagedUserUpdateInput>({
    resolver: zodResolver(managedUserUpdateSchema),
    defaultValues: { userId: user.id, role: user.role, isActive: user.is_active },
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(values: ManagedUserUpdateInput) {
    setError(null);
    try {
      await onSaved(values);
    } catch (cause) {
      setError(errorMessage(cause, "We could not update this account."));
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}>
      <div className="rounded-lg bg-muted px-4 py-3">
        <p className="font-semibold">{user.full_name || user.email || "Unnamed account"}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <FormField error={form.formState.errors.role?.message} htmlFor="managed-role" label="Role" required>
        <select className={nativeSelectClassName} id="managed-role" {...form.register("role")}>
          {APP_ROLES.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
        </select>
      </FormField>
      <CheckboxField {...form.register("isActive")}>Account is active (can sign in)</CheckboxField>
      {error ? <ErrorState message={error} /> : null}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Saving…" : "Save account"}</Button>
    </form>
  );
}

function accountName(user: ManagedUser) {
  return user.full_name || user.email || "account";
}

function ManagedUsersTable({ onDeactivate, onDelete, onEdit, pendingId, rows, showProfiles }: {
  onDeactivate: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
  onEdit: (user: ManagedUser) => void;
  pendingId: string | null;
  rows: ManagedUser[];
  showProfiles: boolean;
}) {
  return (
    <DataTable caption="Managed accounts" columns={["Account", "Role", "Status", "Actions"]} minWidth="min-w-[760px]">
      {rows.length ? rows.map((user) => (
        <tr className="border-t" key={user.id}>
          <td className="px-4 py-3 align-top">
            <p className="font-semibold">{user.full_name || "Unnamed account"}</p>
            <p className="break-all text-muted-foreground">{user.email}</p>
            {user.pending_activation ? <Badge className="mt-2" variant="outline">Pending employee activation</Badge> : null}
          </td>
          <td className="px-4 py-3 align-top">{roleLabels[user.role]}</td>
          <td className="px-4 py-3 align-top"><StatusBadge active={user.is_active} /></td>
          <RowActions>
            {showProfiles && user.employee_id ? (
              <Link aria-label={`View profile for ${accountName(user)}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold hover:bg-muted" href={`/admin/users/${user.id}/profile`}>
                View profile
              </Link>
            ) : null}
            <Button onClick={() => onEdit(user)} size="sm" type="button" variant="outline">Edit</Button>
            {user.is_active ? (
              <Button aria-label={`Deactivate ${accountName(user)}`} disabled={pendingId === user.id} onClick={() => onDeactivate(user)} size="sm" type="button" variant="outline">
                {pendingId === user.id ? "Deactivating…" : "Deactivate"}
              </Button>
            ) : null}
            <Button aria-label={`Delete ${accountName(user)}`} onClick={() => onDelete(user)} size="sm" type="button" variant="destructive">Delete</Button>
          </RowActions>
        </tr>
      )) : <tr><EmptyTableState colSpan={4} message="No accounts match these filters. Clear the search or filters to see all accounts." /></tr>}
    </DataTable>
  );
}

function ManagedAccountsWorkspace({ invite }: { invite: boolean }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const filters = { page, pageSize: 20 as const, ...(search ? { search } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}) };
  const result = useManagedUsers(filters);
  const inviteMutation = useInviteInternalUser();
  const updateMutation = useUpdateManagedUser();

  function resetPage(callback: () => void) {
    callback();
    setPage(1);
  }

  async function deactivate(user: ManagedUser) {
    setActionError(null);
    setNotice(null);
    setPendingId(user.id);
    try {
      await updateMutation.mutateAsync({ input: { userId: user.id, role: user.role, isActive: false } });
      setNotice(`${accountName(user)} was deactivated and can no longer sign in.`);
    } catch (cause) {
      setActionError(errorMessage(cause, "We could not deactivate this account."));
      throw cause;
    } finally {
      setPendingId(null);
    }
  }

  if (result.isLoading) return <LoadingState label="Loading accounts…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <UserFilters
          onRoleChange={(value) => resetPage(() => setRole(value))}
          onSearchChange={(value) => resetPage(() => setSearch(value))}
          onStatusChange={(value) => resetPage(() => setStatus(value))}
          role={role}
          search={search}
          status={status}
        />
        {invite ? <Button className="w-full sm:w-auto" onClick={() => setInviteOpen(true)} type="button">Invite account</Button> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        <strong>Deactivate</strong> blocks sign-in but keeps the account and everything it created. <strong>Delete</strong> permanently removes an account that has no dependent records.
      </p>
      {actionError ? <ErrorState message={actionError} /> : null}
      <SuccessMessage message={notice} />
      <ManagedUsersTable
        onDeactivate={(user) => void deactivate(user).catch(() => undefined)}
        onDelete={setDeleting}
        onEdit={setSelected}
        pendingId={pendingId}
        rows={result.data?.rows ?? []}
        showProfiles={invite}
      />
      <PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} />
      {invite ? (
        <AdministrationFormPanel description="Invite an internal account without exposing administrative credentials." onOpenChange={setInviteOpen} open={inviteOpen} title="Invite account">
          <InvitationForm
            onSaved={async (input) => {
              await inviteMutation.mutateAsync(input);
              setInviteOpen(false);
              setNotice(`Invitation sent to ${input.email}.`);
            }}
            pending={inviteMutation.isPending}
          />
        </AdministrationFormPanel>
      ) : null}
      {selected ? (
        <AdministrationFormPanel description="Role and status changes use the audited protected workflow." onOpenChange={(open) => { if (!open) setSelected(null); }} open title="Manage account">
          <ManagedUserForm
            key={selected.id}
            onSaved={async (input) => {
              await updateMutation.mutateAsync({ input });
              setSelected(null);
              setNotice("Account changes saved.");
            }}
            pending={updateMutation.isPending}
            user={selected}
          />
        </AdministrationFormPanel>
      ) : null}
      <DeleteRecordDialog
        alternative={deleting?.is_active ? { label: "Deactivate instead", onSelect: () => deactivate(deleting) } : undefined}
        entityId={deleting?.id ?? null}
        entityType="managed_user"
        noun="account"
        onClose={() => setDeleting(null)}
        onDeleted={() => setNotice("The account was permanently deleted.")}
      />
    </div>
  );
}

export function UsersWorkspace() {
  return <ManagedAccountsWorkspace invite />;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

function ReferenceFilters({ label, onSearchChange, onStatusChange, search, status }: { label: string; onSearchChange: (value: string) => void; onStatusChange: (value: StatusFilter) => void; search: string; status: StatusFilter }) {
  return (
    <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Input aria-label={`Search ${label}`} onChange={(event) => onSearchChange(event.target.value)} placeholder={`Search ${label}`} type="search" value={search} />
      <StatusSelect label={`Filter ${label} by status`} onChange={onStatusChange} value={status} />
    </div>
  );
}

function DepartmentForm({ department, onSaved, pending }: { department?: Department; onSaved: (input: DepartmentInput) => Promise<void>; pending: boolean }) {
  const form = useForm<z.input<typeof departmentSchema>, unknown, DepartmentInput>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: department?.name ?? "", isActive: department?.is_active ?? true },
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(values: DepartmentInput) {
    setError(null);
    try {
      await onSaved(values);
    } catch (cause) {
      setError(errorMessage(cause, "We could not save the department."));
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}>
      <FormField error={form.formState.errors.name?.message} htmlFor="department-name" label="Name" required>
        <Input id="department-name" {...form.register("name")} />
      </FormField>
      <CheckboxField {...form.register("isActive")}>Department is active</CheckboxField>
      {error ? <ErrorState message={error} /> : null}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Saving…" : "Save department"}</Button>
    </form>
  );
}

export function DepartmentsWorkspace() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const result = useDepartments({ page, pageSize: 20, ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const save = useSaveDepartment();
  const resetPage = (callback: () => void) => {
    callback();
    setPage(1);
  };

  async function setActive(department: Department, isActive: boolean) {
    setActionError(null);
    setNotice(null);
    try {
      await save.mutateAsync({ departmentId: department.id, input: { name: department.name, isActive } });
      setNotice(`${department.name} was ${isActive ? "reactivated" : "deactivated"}.`);
    } catch (cause) {
      setActionError(errorMessage(cause, "We could not update the department."));
      throw cause;
    }
  }

  if (result.isLoading) return <LoadingState label="Loading departments…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;
  const rows = result.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ReferenceFilters label="departments" onSearchChange={(value) => resetPage(() => setSearch(value))} onStatusChange={(value) => resetPage(() => setStatus(value))} search={search} status={status} />
        <Button className="w-full sm:w-auto" onClick={() => setCreating(true)} type="button">Add department</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Deactivated departments are hidden from new records but stay on historic ones.
      </p>
      {actionError ? <ErrorState message={actionError} /> : null}
      <SuccessMessage message={notice} />
      <DataTable caption="Departments" columns={["Department", "Status", "Actions"]} minWidth="min-w-[560px]">
        {rows.length ? rows.map((department) => (
          <tr className="border-t" key={department.id}>
            <td className="px-4 py-3 font-semibold">{department.name}</td>
            <td className="px-4 py-3"><StatusBadge active={department.is_active} /></td>
            <RowActions>
              <Button onClick={() => setEditing(department)} size="sm" type="button" variant="outline">Edit</Button>
              <Button
                aria-label={`${department.is_active ? "Deactivate" : "Activate"} ${department.name}`}
                disabled={save.isPending}
                onClick={() => void setActive(department, !department.is_active).catch(() => undefined)}
                size="sm"
                type="button"
                variant="outline"
              >
                {department.is_active ? "Deactivate" : "Activate"}
              </Button>
            </RowActions>
          </tr>
        )) : <tr><EmptyTableState colSpan={3} message="No departments match these filters." /></tr>}
      </DataTable>
      <PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} />
      <AdministrationFormPanel description="Create a department for personnel and job openings." onOpenChange={setCreating} open={creating} title="Add department">
        <DepartmentForm onSaved={async (input) => { await save.mutateAsync({ input }); setCreating(false); setNotice(`${input.name} was added.`); }} pending={save.isPending} />
      </AdministrationFormPanel>
      {editing ? (
        <AdministrationFormPanel description="Changes are audited and historical references are preserved." onOpenChange={(open) => { if (!open) setEditing(null); }} open title="Edit department">
          <DepartmentForm department={editing} key={editing.id} onSaved={async (input) => { await save.mutateAsync({ input, departmentId: editing.id }); setEditing(null); setNotice("Department saved."); }} pending={save.isPending} />
        </AdministrationFormPanel>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unit stations (used by personnel records and deployments)
// ---------------------------------------------------------------------------

function UnitStationForm({ onSaved, pending, unitStation }: { onSaved: (input: UnitStationInput) => Promise<void>; pending: boolean; unitStation?: UnitStation }) {
  const form = useForm<z.input<typeof unitStationSchema>, unknown, UnitStationInput>({
    resolver: zodResolver(unitStationSchema),
    defaultValues: { name: unitStation?.name ?? "", isActive: unitStation?.is_active ?? true },
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(values: UnitStationInput) {
    setError(null);
    try {
      await onSaved(values);
    } catch (cause) {
      setError(errorMessage(cause, "We could not save the unit/station."));
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}>
      <FormField description={unitStation ? "A name already used on personnel or deployment records cannot be changed; add the corrected station and deactivate this one." : undefined} error={form.formState.errors.name?.message} htmlFor="unit-station-name" label="Name" required>
        <Input id="unit-station-name" {...form.register("name")} />
      </FormField>
      <CheckboxField {...form.register("isActive")}>Unit/station is active</CheckboxField>
      {error ? <ErrorState message={error} /> : null}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Saving…" : "Save unit/station"}</Button>
    </form>
  );
}

export function UnitStationsWorkspace() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UnitStation | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const result = useUnitStationCatalogue({ page, pageSize: 20, ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const save = useSaveUnitStation();
  const resetPage = (callback: () => void) => {
    callback();
    setPage(1);
  };

  async function setActive(unitStation: UnitStation, isActive: boolean) {
    setActionError(null);
    setNotice(null);
    try {
      await save.mutateAsync({ unitStationId: unitStation.id, input: { name: unitStation.name, isActive } });
      setNotice(`${unitStation.name} was ${isActive ? "reactivated" : "deactivated"}.`);
    } catch (cause) {
      setActionError(errorMessage(cause, "We could not update the unit/station."));
    }
  }

  if (result.isLoading) return <LoadingState label="Loading unit stations…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;
  const rows = result.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ReferenceFilters label="unit stations" onSearchChange={(value) => resetPage(() => setSearch(value))} onStatusChange={(value) => resetPage(() => setStatus(value))} search={search} status={status} />
        <Button className="w-full sm:w-auto" onClick={() => setCreating(true)} type="button">Add unit/station</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Active stations appear in the Unit / Station field of personnel records and the Unit assignment field of deployments. Deactivated stations stay on historic records.
      </p>
      {actionError ? <ErrorState message={actionError} /> : null}
      <SuccessMessage message={notice} />
      <DataTable caption="Unit stations" columns={["Unit/station", "Status", "Actions"]} minWidth="min-w-[560px]">
        {rows.length ? rows.map((unitStation) => (
          <tr className="border-t" key={unitStation.id}>
            <td className="px-4 py-3 font-semibold">{unitStation.name}</td>
            <td className="px-4 py-3"><StatusBadge active={unitStation.is_active} /></td>
            <RowActions>
              <Button aria-label={`Edit ${unitStation.name}`} onClick={() => setEditing(unitStation)} size="sm" type="button" variant="outline">Edit</Button>
              <Button
                aria-label={`${unitStation.is_active ? "Deactivate" : "Activate"} ${unitStation.name}`}
                disabled={save.isPending}
                onClick={() => void setActive(unitStation, !unitStation.is_active)}
                size="sm"
                type="button"
                variant="outline"
              >
                {unitStation.is_active ? "Deactivate" : "Activate"}
              </Button>
            </RowActions>
          </tr>
        )) : <tr><EmptyTableState colSpan={3} message={search || status ? "No unit stations match these filters." : "No unit stations yet. Add the station's precincts and units so they can be assigned."} /></tr>}
      </DataTable>
      <PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} />
      <AdministrationFormPanel description="Create a unit or station for personnel records and deployments." onOpenChange={setCreating} open={creating} title="Add unit/station">
        <UnitStationForm onSaved={async (input) => { await save.mutateAsync({ input }); setCreating(false); setNotice(`${input.name} was added.`); }} pending={save.isPending} />
      </AdministrationFormPanel>
      {editing ? (
        <AdministrationFormPanel description="Changes are audited and historical references are preserved." onOpenChange={(open) => { if (!open) setEditing(null); }} open title="Edit unit/station">
          <UnitStationForm key={editing.id} onSaved={async (input) => { await save.mutateAsync({ input, unitStationId: editing.id }); setEditing(null); setNotice("Unit/station saved."); }} pending={save.isPending} unitStation={editing} />
        </AdministrationFormPanel>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranks (shared by every department; deactivated, never deleted)
// ---------------------------------------------------------------------------

function RankForm({ onSaved, pending, rank }: { onSaved: (input: RankInput) => Promise<void>; pending: boolean; rank?: Rank }) {
  const form = useForm<z.input<typeof rankSchema>, unknown, RankInput>({
    resolver: zodResolver(rankSchema),
    defaultValues: {
      name: rank?.name ?? "",
      code: rank?.code ?? "",
      sortOrder: rank?.sort_order ?? "",
      isActive: rank?.is_active ?? true,
    },
  });
  const [error, setError] = useState<string | null>(null);
  const errors = form.formState.errors;

  async function submit(values: RankInput) {
    setError(null);
    try {
      await onSaved(values);
    } catch (cause) {
      setError(errorMessage(cause, "We could not save the rank."));
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}>
      <FormField error={errors.name?.message} htmlFor="rank-name" label="Name" required>
        <Input id="rank-name" {...form.register("name")} />
      </FormField>
      <FormField description="Short code shown with the rank, for example Pat." error={errors.code?.message} htmlFor="rank-code" label="Code" required>
        <Input id="rank-code" {...form.register("code")} />
      </FormField>
      <FormField description="Seniority order: 1 is the most junior rank." error={errors.sortOrder?.message} htmlFor="rank-order" label="Order" required>
        <Input id="rank-order" inputMode="numeric" type="number" {...form.register("sortOrder")} />
      </FormField>
      <CheckboxField {...form.register("isActive")}>Rank is active</CheckboxField>
      {error ? <ErrorState message={error} /> : null}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Saving…" : "Save rank"}</Button>
    </form>
  );
}

export function RanksWorkspace() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Rank | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const result = useRanks({ page, pageSize: 20, ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const save = useSaveRank();
  const resetPage = (callback: () => void) => {
    callback();
    setPage(1);
  };

  async function setActive(rank: Rank, isActive: boolean) {
    setActionError(null);
    setNotice(null);
    try {
      await save.mutateAsync({ rankId: rank.id, input: { name: rank.name, code: rank.code, sortOrder: rank.sort_order, isActive } });
      setNotice(`${rank.name} was ${isActive ? "reactivated" : "deactivated"}.`);
    } catch (cause) {
      setActionError(errorMessage(cause, "We could not update the rank."));
      throw cause;
    }
  }

  if (result.isLoading) return <LoadingState label="Loading ranks…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;
  const rows = result.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ReferenceFilters label="ranks" onSearchChange={(value) => resetPage(() => setSearch(value))} onStatusChange={(value) => resetPage(() => setStatus(value))} search={search} status={status} />
        <Button className="w-full sm:w-auto" onClick={() => setCreating(true)} type="button">Add rank</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Every rank is available in every department. Deactivated ranks are hidden from new records but stay on historic ones.
      </p>
      {actionError ? <ErrorState message={actionError} /> : null}
      <SuccessMessage message={notice} />
      <DataTable caption="Ranks" columns={["Code", "Name", "Order", "Status", "Actions"]} minWidth="min-w-[640px]">
        {rows.length ? rows.map((rank) => (
          <tr className="border-t" key={rank.id}>
            <td className="px-4 py-3 font-semibold">{rank.code}</td>
            <td className="px-4 py-3">{rank.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{rank.sort_order}</td>
            <td className="px-4 py-3"><StatusBadge active={rank.is_active} /></td>
            <RowActions>
              <Button onClick={() => setEditing(rank)} size="sm" type="button" variant="outline">Edit</Button>
              <Button
                aria-label={`${rank.is_active ? "Deactivate" : "Activate"} ${rank.name}`}
                disabled={save.isPending}
                onClick={() => void setActive(rank, !rank.is_active).catch(() => undefined)}
                size="sm"
                type="button"
                variant="outline"
              >
                {rank.is_active ? "Deactivate" : "Activate"}
              </Button>
            </RowActions>
          </tr>
        )) : <tr><EmptyTableState colSpan={5} message="No ranks match these filters." /></tr>}
      </DataTable>
      <PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} />
      <AdministrationFormPanel description="Add a police rank. It becomes available in every department." onOpenChange={setCreating} open={creating} title="Add rank">
        <RankForm onSaved={async (input) => { await save.mutateAsync({ input, rankId: undefined }); setCreating(false); setNotice(`${input.name} was added.`); }} pending={save.isPending} />
      </AdministrationFormPanel>
      {editing ? (
        <AdministrationFormPanel description="Changes are audited and historical references are preserved." onOpenChange={(open) => { if (!open) setEditing(null); }} open title="Edit rank">
          <RankForm key={editing.id} onSaved={async (input) => { await save.mutateAsync({ input, rankId: editing.id }); setEditing(null); setNotice("Rank saved."); }} pending={save.isPending} rank={editing} />
        </AdministrationFormPanel>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function timeZoneOptions(current: string | undefined) {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Asia/Manila", "UTC"];
  const all = current && !zones.includes(current) ? [current, ...zones] : zones;
  return all.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }));
}

export function SettingsWorkspace() {
  const result = useOrganizationSettings();
  const save = useSaveOrganizationSettings();
  const form = useForm<OrganizationSettingsInput>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: { organizationName: "", supportEmail: "", defaultTimezone: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => timeZoneOptions(result.data?.default_timezone), [result.data?.default_timezone]);

  useEffect(() => {
    if (result.data) form.reset({ organizationName: result.data.organization_name, supportEmail: result.data.support_email, defaultTimezone: result.data.default_timezone });
  }, [form, result.data]);

  if (result.isLoading) return <LoadingState label="Loading organization settings…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;

  async function submit(values: OrganizationSettingsInput) {
    setError(null);
    try {
      await save.mutateAsync(values);
      setOpen(false);
      setNotice("Organization settings saved.");
    } catch (cause) {
      setError(errorMessage(cause, "We could not save the settings."));
    }
  }

  const settings = result.data;
  const errors = form.formState.errors;
  return (
    <div className="max-w-2xl space-y-5">
      <SuccessMessage message={notice} />
      <dl className="divide-y rounded-xl border bg-card">
        <div className="space-y-1 px-5 py-4"><dt className="text-sm font-semibold text-muted-foreground">Organization name</dt><dd>{settings?.organization_name || "Not configured"}</dd></div>
        <div className="space-y-1 px-5 py-4"><dt className="text-sm font-semibold text-muted-foreground">Support email</dt><dd>{settings?.support_email || "Not configured"}</dd></div>
        <div className="space-y-1 px-5 py-4"><dt className="text-sm font-semibold text-muted-foreground">Default time zone</dt><dd>{settings?.default_timezone || "Not configured"}</dd></div>
      </dl>
      <Button onClick={() => setOpen(true)} type="button">Edit organization settings</Button>
      <AdministrationFormPanel description="Update the organization identity, support contact, and default time zone. Application secrets are never shown here." onOpenChange={setOpen} open={open} title="Organization settings">
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}>
          <FormField error={errors.organizationName?.message} htmlFor="organization-name" label="Organization name" required>
            <Input id="organization-name" {...form.register("organizationName")} />
          </FormField>
          <FormField error={errors.supportEmail?.message} htmlFor="support-email" label="Support email" required>
            <Input autoComplete="email" id="support-email" type="email" {...form.register("supportEmail")} />
          </FormField>
          <FormField description="Type a city or region to search, for example Manila." error={errors.defaultTimezone?.message} htmlFor="default-timezone" label="Default time zone" required>
            <Controller
              control={form.control}
              name="defaultTimezone"
              render={({ field }) => (
                <Combobox
                  emptyMessage="No time zone matches that search."
                  id="default-timezone"
                  onValueChange={(value) => field.onChange(value ?? "")}
                  options={zones}
                  placeholder="Search time zones"
                  value={field.value || null}
                />
              )}
            />
          </FormField>
          {error ? <ErrorState message={error} /> : null}
          <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save settings"}</Button>
        </form>
      </AdministrationFormPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

const AUDIT_ENTITY_SUGGESTIONS = [
  "applications", "attendance_imports", "attendance_integration_settings", "attendance_unmatched_events", "deployments",
  "departments", "employees", "job_openings", "leave_requests", "leave_types", "organization_settings", "performance_ratings",
  "profile_change_requests", "ranks", "profiles", "promotion_criteria", "promotion_evaluations", "user_roles",
];
const AUDIT_ACTION_SUGGESTIONS = ["insert", "update", "delete", "created", "updated", "hired", "imported", "resolved", "queued"];

export function AuditLogsWorkspace() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogDisplay | null>(null);
  const result = useAuditLogs({ page, pageSize: 20, ...(search ? { search } : {}), ...(entityType ? { entityType } : {}), ...(action ? { action } : {}) });
  const resetPage = (callback: () => void) => {
    callback();
    setPage(1);
  };
  const filtered = Boolean(search || entityType || action);

  if (result.isLoading) return <LoadingState label="Loading audit history…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;
  const rows = result.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <FormField htmlFor="audit-search" label="Search">
          <Input id="audit-search" onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Record, ID, or action" type="search" value={search} />
        </FormField>
        <FormField htmlFor="audit-entity" label="Record type">
          <Input id="audit-entity" list="audit-entity-options" onChange={(event) => resetPage(() => setEntityType(event.target.value.trim()))} placeholder="Any" value={entityType} />
        </FormField>
        <FormField htmlFor="audit-action" label="Action">
          <Input id="audit-action" list="audit-action-options" onChange={(event) => resetPage(() => setAction(event.target.value.trim()))} placeholder="Any" value={action} />
        </FormField>
        <Button disabled={!filtered} onClick={() => resetPage(() => { setSearch(""); setEntityType(""); setAction(""); })} type="button" variant="outline">Clear filters</Button>
        <datalist id="audit-entity-options">{AUDIT_ENTITY_SUGGESTIONS.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="audit-action-options">{AUDIT_ACTION_SUGGESTIONS.map((value) => <option key={value} value={value} />)}</datalist>
      </div>
      <DataTable caption="Audit history" columns={["When", "Actor", "Record", "Action", "Details"]} minWidth="min-w-[820px]">
        {rows.length ? rows.map((entry) => (
          <tr className="border-t" key={entry.id}>
            <td className="px-4 py-3 whitespace-nowrap"><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></td>
            <td className="px-4 py-3">{entry.actorLabel}</td>
            <td className="px-4 py-3">{entry.recordLabel}</td>
            <td className="px-4 py-3">{entry.actionLabel}</td>
            <td className="px-4 py-3">
              <Button aria-label={`View details for audit record ${entry.id}`} onClick={() => setSelected(entry)} size="sm" type="button" variant="outline">Details</Button>
            </td>
          </tr>
        )) : <tr><EmptyTableState colSpan={5} message={filtered ? "No audit entries match these filters." : "No audit entries have been recorded yet."} /></tr>}
      </DataTable>
      <PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} />
      {selected ? (
        <AdministrationFormPanel description="Original audit values are available for traceability and cannot be changed." onOpenChange={(open) => { if (!open) setSelected(null); }} open title="Audit record details">
          <div className="space-y-4">
            <p className="rounded-lg bg-muted px-4 py-3">{selected.summary}</p>
            <dl className="grid gap-3">
              <div><dt className="text-sm font-semibold text-muted-foreground">Actor</dt><dd>{selected.actorLabel}</dd></div>
              <div><dt className="text-sm font-semibold text-muted-foreground">When</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div>
            </dl>
            <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(selected.details, null, 2)}</pre>
          </div>
        </AdministrationFormPanel>
      ) : null}
    </div>
  );
}
