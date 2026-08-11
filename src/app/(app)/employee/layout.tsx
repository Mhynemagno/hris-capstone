import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/require-role";

export default async function EmployeeLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("employee");

  return children;
}
