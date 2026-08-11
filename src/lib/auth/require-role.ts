import { redirect } from "next/navigation";

import { getCurrentRole } from "@/lib/auth/current-role";
import { getAuthenticatedUser, type AuthenticatedUser } from "@/lib/auth/current-user";
import type { AppRole } from "@/lib/types/roles";

export type AuthenticatedRole = {
  user: AuthenticatedUser;
  role: AppRole;
};

export async function requireRole(
  expectedRole: AppRole,
): Promise<AuthenticatedRole> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getCurrentRole();

  if (role !== expectedRole) {
    redirect("/unauthorized");
  }

  return { user, role };
}
