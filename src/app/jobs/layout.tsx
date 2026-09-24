import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import { PublicSiteHeader } from "@/components/recruitment/public-site-header";
import { getCurrentRole } from "@/lib/auth/current-role";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { getRoleConfig } from "@/lib/app/role-config";

export default async function JobsLayout({ children }: { children: ReactNode }) {
  const user = await getAuthenticatedUser();
  const role = user ? await getCurrentRole() : null;

  return (
    <QueryProvider>
      {user && role === "applicant" ? (
        <AppShell config={getRoleConfig("applicant")} email={user.email}>{children}</AppShell>
      ) : (
        <>
          <PublicSiteHeader />
          {children}
        </>
      )}
    </QueryProvider>
  );
}
