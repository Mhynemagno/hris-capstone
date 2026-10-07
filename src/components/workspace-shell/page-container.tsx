import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Declares how wide a redesigned page is. The shell's content column reads this through
 * CSS :has(), so pages that do not use it keep today's 1152px width.
 */
export function PageContainer({ children, className, width }: { width: "wide" | "narrow"; children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6", className)} data-page-width={width}>{children}</div>;
}
