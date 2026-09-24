import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared styling for native <select> controls. Native selects are used for
 * short, finite option sets because they are keyboard, screen-reader, and
 * mobile friendly without extra JavaScript. Long lists use `Combobox`.
 */
export const nativeSelectClassName =
  "min-h-11 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-background bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:1rem] bg-[position:right_0.75rem_center] bg-no-repeat py-2 pr-10 pl-3 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(nativeSelectClassName, className)} data-slot="native-select" {...props} />;
}
