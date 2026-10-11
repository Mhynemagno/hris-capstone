import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import { StaffShell } from "@/components/staff-shell/staff-shell";
import { WorkspaceShell } from "@/components/workspace-shell/workspace-shell";
import { getCurrentRole } from "@/lib/auth/current-role";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { getStaffDisplayName } from "@/lib/auth/staff-display-name";
import { getRoleConfig } from "@/lib/app/role-config";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getCurrentRole();

  if (!role) {
    redirect("/unauthorized");
  }

  const config = getRoleConfig(role);
  if (role === "hr_personnel" || role === "employee" || role === "system_administrator") {
    // HR, employees, and system administrators use the Capstone UI staff shell.
    const fallbackName = role === "hr_personnel" ? "HR Personnel" : role === "employee" ? "Employee" : "System Administrator";
    const displayName = await getStaffDisplayName(user.id, user.email ?? fallbackName);
    return (
      <QueryProvider>
        <StaffShell config={config} displayName={displayName} email={user.email}>
          {children}
        </StaffShell>
      </QueryProvider>
    );
  }

  // Applicants keep the Capstone UI applicant shell; other internal roles keep the workspace shell until their redesign.
  const Shell = role === "applicant" ? AppShell : WorkspaceShell;

  return (
    <QueryProvider>
      <Shell config={config} email={user.email}>
        {children}
      </Shell>
    </QueryProvider>
  );
}
