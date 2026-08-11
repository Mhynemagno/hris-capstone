import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import { getCurrentRole } from "@/lib/auth/current-role";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
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

  return (
    <QueryProvider>
      <AppShell config={getRoleConfig(role)} email={user.email}>
        {children}
      </AppShell>
    </QueryProvider>
  );
}
