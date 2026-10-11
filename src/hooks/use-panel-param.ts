"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** One URL search param holding which panel is open (e.g. ?review=<id>), so panels survive reloads and links. */
export function usePanelParam(name: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(name);
  const set = useCallback((next: string | null) => {
    const updated = new URLSearchParams(params.toString());
    if (next === null) updated.delete(name);
    else updated.set(name, next);
    const query = updated.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [name, params, pathname, router]);
  return [value, set] as const;
}
