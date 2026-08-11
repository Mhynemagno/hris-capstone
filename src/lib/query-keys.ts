import type { AppRole } from "@/lib/types/roles";

export const queryKeys = {
  appShell: () => ["app-shell"] as const,
  roleLanding: (role: AppRole) => ["role-landing", role] as const,
};
