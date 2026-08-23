import type { ReactNode } from "react";

import { requireAnyRole } from "@/lib/auth/require-role";

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireAnyRole(["hr_personnel", "management"]);
  return children;
}
