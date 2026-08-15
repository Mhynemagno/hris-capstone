"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { AdministrationFormPanel } from "@/components/administration/administration-form-panel";
import { PaginatedTableControls } from "@/components/administration/paginated-table-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyTableState } from "@/components/ui/empty-table-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import {
  useInviteInternalUser,
  useAuditLogs,
  useDepartments,
  useManagedUsers,
  useOrganizationSettings,
  usePositions,
  useSaveDepartment,
  useSaveOrganizationSettings,
  useSavePosition,
  useUpdateManagedUser,
} from "@/hooks/use-administration";
import type { Department, ManagedUser, Position } from "@/lib/types/database";
import { APP_ROLES, type AppRole } from "@/lib/types/roles";
import {
  departmentSchema,
  internalInvitationSchema,
  managedUserUpdateSchema,
  organizationSettingsSchema,
  positionSchema,
  type DepartmentInput,
  type InternalInvitationInput,
  type ManagedUserUpdateInput,
  type OrganizationSettingsInput,
  type PositionInput,
} from "@/schemas/administration";

const roleLabels: Record<AppRole, string> = {
  system_administrator: "System Administrator",
  hr_personnel: "HR Personnel",
  applicant: "Applicant",
  employee: "Employee",
  management: "Management",
};

function ErrorWithRetry({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return <div className="space-y-3"><ErrorState message={error.message} /><Button onClick={onRetry} type="button" variant="outline">Retry</Button></div>;
}

function UserFilters({ onRoleChange, onSearchChange, onStatusChange, role, search, status }: {
  onRoleChange: (value: AppRole | "") => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: "active" | "inactive" | "") => void;
  role: AppRole | "";
  search: string;
  status: "active" | "inactive" | "";
}) {
  return <div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Search accounts" onChange={(event) => onSearchChange(event.target.value)} placeholder="Search name or email" value={search} /><select aria-label="Filter users by role" className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm" onChange={(event) => onRoleChange(event.target.value as AppRole | "")} value={role}><option value="">All roles</option>{APP_ROLES.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select><select aria-label="Filter users by status" className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm" onChange={(event) => onStatusChange(event.target.value as "active" | "inactive" | "")} value={status}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>;
}

function InvitationForm({ onSaved, pending }: { onSaved: (input: InternalInvitationInput) => Promise<void>; pending: boolean }) {
  const form = useForm<InternalInvitationInput>({
    resolver: zodResolver(internalInvitationSchema),
    defaultValues: { email: "", fullName: "", role: "employee" },
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(values: InternalInvitationInput) {
    setError(null);
    try { await onSaved(values); form.reset(); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not send the invitation."); }
  }

  return <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}><FormField error={form.formState.errors.fullName?.message} htmlFor="invite-full-name" label="Full name"><Input aria-invalid={Boolean(form.formState.errors.fullName)} id="invite-full-name" {...form.register("fullName")} /></FormField><FormField error={form.formState.errors.email?.message} htmlFor="invite-email" label="Email"><Input aria-invalid={Boolean(form.formState.errors.email)} id="invite-email" type="email" {...form.register("email")} /></FormField><FormField error={form.formState.errors.role?.message} htmlFor="invite-role" label="Role"><select className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" id="invite-role" {...form.register("role")}>{APP_ROLES.filter((role) => role !== "applicant").map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></FormField>{error ? <ErrorState message={error} /> : null}<Button className="w-full" disabled={pending} type="submit">{pending ? "Sending…" : "Send invitation"}</Button></form>;
}

function ManagedUserForm({ onSaved, pending, user }: { onSaved: (input: ManagedUserUpdateInput) => Promise<void>; pending: boolean; user: ManagedUser }) {
  const form = useForm<ManagedUserUpdateInput>({
    resolver: zodResolver(managedUserUpdateSchema),
    defaultValues: { userId: user.id, role: user.role, isActive: user.is_active },
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(values: ManagedUserUpdateInput) {
    setError(null);
    try { await onSaved(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not update this account."); }
  }

  return <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}><p className="rounded-lg bg-muted px-3 py-2 text-sm"><span className="font-medium">{user.full_name || user.email || "Unnamed account"}</span><br />{user.email}</p><FormField error={form.formState.errors.role?.message} htmlFor="managed-role" label="Role"><select className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" id="managed-role" {...form.register("role")}>{APP_ROLES.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></FormField><label className="flex items-center gap-2 text-sm font-medium"><input className="size-4" type="checkbox" {...form.register("isActive")} />Account is active</label>{error ? <ErrorState message={error} /> : null}<Button className="w-full" disabled={pending} type="submit">{pending ? "Saving…" : "Save account"}</Button></form>;
}

function ManagedUsersTable({ onEdit, rows }: { onEdit: (user: ManagedUser) => void; rows: ManagedUser[] }) {
  return <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.length ? rows.map((user) => <tr className="border-t" key={user.id}><td className="px-4 py-3"><p className="font-medium">{user.full_name || "Unnamed account"}</p><p className="text-muted-foreground">{user.email}</p></td><td className="px-4 py-3">{roleLabels[user.role]}</td><td className="px-4 py-3"><Badge variant={user.is_active ? "secondary" : "outline"}>{user.is_active ? "Active" : "Inactive"}</Badge></td><td className="px-4 py-3 text-right"><Button onClick={() => onEdit(user)} type="button" variant="outline">Edit</Button></td></tr>) : <tr><EmptyTableState colSpan={4} message="No accounts match these filters." /></tr>}</tbody></table></div>;
}

function ManagedAccountsWorkspace({ invite }: { invite: boolean }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [status, setStatus] = useState<"active" | "inactive" | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const filters = { page, pageSize: 20 as const, ...(search ? { search } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}) };
  const result = useManagedUsers(filters);
  const inviteMutation = useInviteInternalUser();
  const updateMutation = useUpdateManagedUser();

  function resetPage(callback: () => void) { callback(); setPage(1); }
  if (result.isLoading) return <LoadingState label="Loading accounts…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;

  return <div className="space-y-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><UserFilters onRoleChange={(value) => resetPage(() => setRole(value))} onSearchChange={(value) => resetPage(() => setSearch(value))} onStatusChange={(value) => resetPage(() => setStatus(value))} role={role} search={search} status={status} />{invite ? <Button onClick={() => setInviteOpen(true)} type="button">Invite account</Button> : null}</div><ManagedUsersTable onEdit={setSelected} rows={result.data?.rows ?? []} /><PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} />{invite ? <AdministrationFormPanel description="Invite an internal account without exposing administrative credentials." onOpenChange={setInviteOpen} open={inviteOpen} title="Invite account"><InvitationForm onSaved={async (input) => { await inviteMutation.mutateAsync(input); setInviteOpen(false); }} pending={inviteMutation.isPending} /></AdministrationFormPanel> : null}{selected ? <AdministrationFormPanel description="Role and status changes use the audited protected workflow." onOpenChange={(open) => { if (!open) setSelected(null); }} open title="Manage account"><ManagedUserForm key={selected.id} onSaved={async (input) => { await updateMutation.mutateAsync({ input }); setSelected(null); }} pending={updateMutation.isPending} user={selected} /></AdministrationFormPanel> : null}</div>;
}

export function UsersWorkspace() { return <ManagedAccountsWorkspace invite />; }

export function RolesWorkspace() { return <ManagedAccountsWorkspace invite={false} />; }

function ReferenceFilters({ label, onSearchChange, onStatusChange, search, status }: { label: string; onSearchChange: (value: string) => void; onStatusChange: (value: "active" | "inactive" | "") => void; search: string; status: "active" | "inactive" | "" }) {
  return <div className="grid gap-3 sm:grid-cols-2"><Input aria-label={`Search ${label}`} onChange={(event) => onSearchChange(event.target.value)} placeholder={`Search ${label}`} value={search} /><select aria-label={`Filter ${label} by status`} className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm" onChange={(event) => onStatusChange(event.target.value as "active" | "inactive" | "")} value={status}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>;
}

function DepartmentForm({ department, onSaved, pending }: { department?: Department; onSaved: (input: DepartmentInput) => Promise<void>; pending: boolean }) {
  const form = useForm<z.input<typeof departmentSchema>, unknown, DepartmentInput>({ resolver: zodResolver(departmentSchema), defaultValues: { name: department?.name ?? "", isActive: department?.is_active ?? true } });
  const [error, setError] = useState<string | null>(null);
  async function submit(values: DepartmentInput) { setError(null); try { await onSaved(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save the department."); } }
  return <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}><FormField error={form.formState.errors.name?.message} htmlFor="department-name" label="Name"><Input aria-invalid={Boolean(form.formState.errors.name)} id="department-name" {...form.register("name")} /></FormField><label className="flex items-center gap-2 text-sm font-medium"><input className="size-4" type="checkbox" {...form.register("isActive")} />Department is active</label>{error ? <ErrorState message={error} /> : null}<Button className="w-full" disabled={pending} type="submit">{pending ? "Saving…" : "Save department"}</Button></form>;
}

export function DepartmentsWorkspace() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const result = useDepartments({ page, pageSize: 20, ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const save = useSaveDepartment();
  const resetPage = (callback: () => void) => { callback(); setPage(1); };
  async function deactivate(department: Department) {
    setActionError(null);
    try { await save.mutateAsync({ departmentId: department.id, input: { name: department.name, isActive: false } }); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "We could not deactivate the department."); }
  }
  if (result.isLoading) return <LoadingState label="Loading departments…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;
  const rows = result.data?.rows ?? [];
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <ReferenceFilters label="departments" onSearchChange={(value) => resetPage(() => setSearch(value))} onStatusChange={(value) => resetPage(() => setStatus(value))} search={search} status={status} />
      <Button onClick={() => setCreating(true)} type="button">Add department</Button>
    </div>
    {actionError ? <ErrorState message={actionError} /> : null}
    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-3">Department</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.length ? rows.map((department) => <tr className="border-t" key={department.id}><td className="px-4 py-3 font-medium">{department.name}</td><td className="px-4 py-3"><Badge variant={department.is_active ? "secondary" : "outline"}>{department.is_active ? "Active" : "Inactive"}</Badge></td><td className="space-x-2 px-4 py-3 text-right"><Button onClick={() => setEditing(department)} type="button" variant="outline">Edit</Button>{department.is_active ? <Button aria-label={`Deactivate ${department.name}`} onClick={() => void deactivate(department)} type="button" variant="destructive">Deactivate</Button> : null}</td></tr>) : <tr><EmptyTableState colSpan={3} message="No departments match these filters." /></tr>}</tbody></table></div>
    <PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} />
    <AdministrationFormPanel description="Create or update a department without deleting historic references." onOpenChange={setCreating} open={creating} title="Add department"><DepartmentForm onSaved={async (input) => { await save.mutateAsync({ input }); setCreating(false); }} pending={save.isPending} /></AdministrationFormPanel>
    {editing ? <AdministrationFormPanel description="Changes are audited and historical references are preserved." onOpenChange={(open) => { if (!open) setEditing(null); }} open title="Edit department"><DepartmentForm department={editing} key={editing.id} onSaved={async (input) => { await save.mutateAsync({ input, departmentId: editing.id }); setEditing(null); }} pending={save.isPending} /></AdministrationFormPanel> : null}
  </div>;
}

function PositionForm({ departments, onSaved, pending, position }: { departments: Department[]; onSaved: (input: PositionInput) => Promise<void>; pending: boolean; position?: Position }) {
  const form = useForm<z.input<typeof positionSchema>, unknown, PositionInput>({ resolver: zodResolver(positionSchema), defaultValues: { departmentId: position?.department_id ?? null, title: position?.title ?? "", code: position?.code ?? "", description: position?.description ?? "", isActive: position?.is_active ?? true } });
  const [error, setError] = useState<string | null>(null);
  async function submit(values: PositionInput) { setError(null); try { await onSaved(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save the position."); } }
  return <form className="space-y-4" noValidate onSubmit={form.handleSubmit(submit)}><FormField error={form.formState.errors.title?.message} htmlFor="position-title" label="Title"><Input aria-invalid={Boolean(form.formState.errors.title)} id="position-title" {...form.register("title")} /></FormField><FormField htmlFor="position-department" label="Department"><select className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" id="position-department" {...form.register("departmentId", { setValueAs: (value) => value ? Number(value) : null })}><option value="">None</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></FormField><FormField error={form.formState.errors.code?.message} htmlFor="position-code" label="Code"><Input id="position-code" {...form.register("code")} /></FormField><FormField error={form.formState.errors.description?.message} htmlFor="position-description" label="Description"><textarea className="min-h-24 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm" id="position-description" {...form.register("description")} /></FormField><label className="flex items-center gap-2 text-sm font-medium"><input className="size-4" type="checkbox" {...form.register("isActive")} />Position is active</label>{error ? <ErrorState message={error} /> : null}<Button className="w-full" disabled={pending} type="submit">{pending ? "Saving…" : "Save position"}</Button></form>;
}

export function PositionsWorkspace() {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState<"active" | "inactive" | "">(""); const [page, setPage] = useState(1); const [editing, setEditing] = useState<Position | null>(null); const [creating, setCreating] = useState(false);
  const result = usePositions({ page, pageSize: 20, ...(search ? { search } : {}), ...(status ? { status } : {}) }); const departmentResult = useDepartments({ page: 1, pageSize: 20, status: "active" }); const save = useSavePosition(); const departments = departmentResult.data?.rows ?? [];
  const resetPage = (callback: () => void) => { callback(); setPage(1); };
  if (result.isLoading) return <LoadingState label="Loading positions…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;
  const rows = result.data?.rows ?? [];
  return <div className="space-y-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><ReferenceFilters label="positions" onSearchChange={(value) => resetPage(() => setSearch(value))} onStatusChange={(value) => resetPage(() => setStatus(value))} search={search} status={status} /><Button onClick={() => setCreating(true)} type="button">Add position</Button></div><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-3">Position</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.length ? rows.map((position) => <tr className="border-t" key={position.id}><td className="px-4 py-3 font-medium">{position.title}</td><td className="px-4 py-3 text-muted-foreground">{position.code || "—"}</td><td className="px-4 py-3"><Badge variant={position.is_active ? "secondary" : "outline"}>{position.is_active ? "Active" : "Inactive"}</Badge></td><td className="space-x-2 px-4 py-3 text-right"><Button onClick={() => setEditing(position)} type="button" variant="outline">Edit</Button>{position.is_active ? <Button aria-label={`Deactivate ${position.title}`} onClick={() => void save.mutateAsync({ positionId: position.id, input: { departmentId: position.department_id, title: position.title, code: position.code ?? undefined, description: position.description ?? undefined, isActive: false } })} type="button" variant="destructive">Deactivate</Button> : null}</td></tr>) : <tr><EmptyTableState colSpan={4} message="No positions match these filters." /></tr>}</tbody></table></div><PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} /><AdministrationFormPanel description="Create or update a position and its optional department assignment." onOpenChange={setCreating} open={creating} title="Add position"><PositionForm departments={departments} onSaved={async (input) => { await save.mutateAsync({ input }); setCreating(false); }} pending={save.isPending} /></AdministrationFormPanel>{editing ? <AdministrationFormPanel description="Changes preserve position history and department references." onOpenChange={(open) => { if (!open) setEditing(null); }} open title="Edit position"><PositionForm departments={departments} key={editing.id} onSaved={async (input) => { await save.mutateAsync({ input, positionId: editing.id }); setEditing(null); }} pending={save.isPending} position={editing} /></AdministrationFormPanel> : null}</div>;
}

export function SettingsWorkspace() {
  const result = useOrganizationSettings(); const save = useSaveOrganizationSettings(); const form = useForm<OrganizationSettingsInput>({ resolver: zodResolver(organizationSettingsSchema), defaultValues: { organizationName: "", supportEmail: "", defaultTimezone: "" } }); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (result.data) form.reset({ organizationName: result.data.organization_name, supportEmail: result.data.support_email, defaultTimezone: result.data.default_timezone }); }, [form, result.data]);
  if (result.isLoading) return <LoadingState label="Loading organization settings…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;
  async function submit(values: OrganizationSettingsInput) { setError(null); try { await save.mutateAsync(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save the settings."); } }
  return <form className="max-w-xl space-y-4" noValidate onSubmit={form.handleSubmit(submit)}><FormField error={form.formState.errors.organizationName?.message} htmlFor="organization-name" label="Organization name"><Input id="organization-name" {...form.register("organizationName")} /></FormField><FormField error={form.formState.errors.supportEmail?.message} htmlFor="support-email" label="Support email"><Input id="support-email" type="email" {...form.register("supportEmail")} /></FormField><FormField error={form.formState.errors.defaultTimezone?.message} htmlFor="default-timezone" label="Default time zone"><Input id="default-timezone" placeholder="Asia/Ulaanbaatar" {...form.register("defaultTimezone")} /></FormField>{error ? <ErrorState message={error} /> : null}<Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save settings"}</Button></form>;
}

export function AuditLogsWorkspace() {
  const [search, setSearch] = useState(""); const [entityType, setEntityType] = useState(""); const [action, setAction] = useState(""); const [page, setPage] = useState(1); const result = useAuditLogs({ page, pageSize: 20, ...(search ? { search } : {}), ...(entityType ? { entityType } : {}), ...(action ? { action } : {}) }); const resetPage = (callback: () => void) => { callback(); setPage(1); };
  if (result.isLoading) return <LoadingState label="Loading audit history…" />;
  if (result.error) return <ErrorWithRetry error={result.error} onRetry={() => void result.refetch()} />;
  const rows = result.data?.rows ?? [];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Search audit history" onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Search audit history" value={search} /><Input aria-label="Filter audit history by entity type" onChange={(event) => resetPage(() => setEntityType(event.target.value))} placeholder="Entity type" value={entityType} /><Input aria-label="Filter audit history by action" onChange={(event) => resetPage(() => setAction(event.target.value))} placeholder="Action" value={action} /></div><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Details</th></tr></thead><tbody>{rows.length ? rows.map((entry) => <tr className="border-t" key={entry.id}><td className="px-4 py-3 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</td><td className="px-4 py-3">{entry.actor_user_id || "System"}</td><td className="px-4 py-3">{entry.entity_type}: {entry.entity_id}</td><td className="px-4 py-3">{entry.action}</td><td className="max-w-72 truncate px-4 py-3" title={JSON.stringify(entry.metadata)}>{JSON.stringify(entry.metadata)}</td></tr>) : <tr><EmptyTableState colSpan={5} message="No audit entries match these filters." /></tr>}</tbody></table></div><PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} /></div>;
}
