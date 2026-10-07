"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type TabItem = { value: string; label: string; count?: number };

export function Tabs({ children, items, label, onValueChange, value }: { value: string; onValueChange: (value: string) => void; items: TabItem[]; label: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Root onValueChange={(next) => onValueChange(String(next))} value={value}>
      <TabsPrimitive.List aria-label={label} className="flex gap-1 overflow-x-auto border-b">
        {items.map((item) => (
          <TabsPrimitive.Tab className="-mb-px inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-base font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:text-primary" key={item.value} value={item.value}>
            {item.label}
            {item.count !== undefined ? <span className="rounded-md bg-muted px-1.5 text-xs text-secondary-foreground tabular-nums">{item.count}</span> : null}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabPanel({ children, value }: { value: string; children: ReactNode }) {
  return <TabsPrimitive.Panel className="pt-5 outline-none" value={value}>{children}</TabsPrimitive.Panel>;
}

/** Keeps the selected tab in `?<param>=`, so links and Back restore it. */
export function useUrlTab(param: string, allowed: readonly string[], fallback: string): [string, (value: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = searchParams.get(param);
  const value = raw && allowed.includes(raw) ? raw : fallback;
  function setValue(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === fallback) params.delete(param); else params.set(param, next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  return [value, setValue];
}
