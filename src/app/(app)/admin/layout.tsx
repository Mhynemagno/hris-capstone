import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/require-role";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole("system_administrator");

  return children;
}
