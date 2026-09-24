import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Multi-line free text (notes, reasons, descriptions) styled to match Input. */
export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
        className,
      )}
      data-slot="textarea"
      rows={rows}
      {...props}
    />
  );
}
