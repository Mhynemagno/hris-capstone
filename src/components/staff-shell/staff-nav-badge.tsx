"use client";

import { useWorkspaceCount } from "@/hooks/use-workspace-counts";
import type { NavBadgeKey } from "@/lib/app/role-config";

/** Capstone UI sidebar count pill. Sits outside the link so the link's name stays stable. */
export function StaffNavBadge({ badge }: { badge: NavBadgeKey }) {
  const { data, isError } = useWorkspaceCount(badge);
  if (isError || !data) return null;
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{data > 99 ? "99+" : data}</span>
      <span className="sr-only">{data} waiting</span>
    </>
  );
}
