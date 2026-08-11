import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/require-role";

export default async function ManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("management");

  return children;
}
