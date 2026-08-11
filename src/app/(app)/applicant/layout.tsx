import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/require-role";

export default async function ApplicantLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("applicant");

  return children;
}
