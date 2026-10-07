"use client";

import { useWorkspaceCount } from "@/hooks/use-workspace-counts";
import type { NavBadgeKey } from "@/lib/app/role-config";

/** A count beside a nav link. Sits outside the link so the link's name stays stable. */
export function NavBadge({ badge }: { badge: NavBadgeKey }) {
  const { data, isError } = useWorkspaceCount(badge);
  if (isError || !data) return null;
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 min-w-5 -translate-y-1/2 rounded-md bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums group-data-[collapsible=icon]:hidden">
        {data > 99 ? "99+" : data}
      </span>
      <span className="sr-only">{data} waiting</span>
    </>
  );
}
