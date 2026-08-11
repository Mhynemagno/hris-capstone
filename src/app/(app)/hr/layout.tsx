import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/require-role";

export default async function HrLayout({ children }: { children: ReactNode }) {
  await requireRole("hr_personnel");

  return children;
}
