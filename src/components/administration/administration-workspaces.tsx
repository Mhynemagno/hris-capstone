"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
  useManagedUsers,
  useUpdateManagedUser,
} from "@/hooks/use-administration";
import type { ManagedUser } from "@/lib/types/database";
import { APP_ROLES, type AppRole } from "@/lib/types/roles";
import {
  internalInvitationSchema,
  managedUserUpdateSchema,
  type InternalInvitationInput,
  type ManagedUserUpdateInput,
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
