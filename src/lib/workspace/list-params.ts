"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** List screen state in the URL so dashboard links, refresh and Back restore the same view. */
export function useListParams<K extends string>(keys: readonly K[], { pageKey = "page" }: { pageKey?: string } = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = Object.fromEntries(keys.map((key) => [key, searchParams.get(key) ?? ""])) as Record<K, string>;

  function write(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function set(patch: Partial<Record<K, string>>, options: { keepPage?: boolean } = {}) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch) as [K, string | undefined][]) {
      if (value) next.set(key, value); else next.delete(key);
    }
    const onlyPage = Object.keys(patch).every((key) => key === pageKey);
    if (!onlyPage && !options.keepPage) next.delete(pageKey);
    write(next);
  }

  function clear(clearKeys: readonly K[]) {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of clearKeys) next.delete(key);
    next.delete(pageKey);
    write(next);
  }

  return { params, set, clear };
}
