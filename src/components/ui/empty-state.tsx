import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ action, description, icon: Icon = Inbox, title }: { title: string; description?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center" role="status">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-5" /></span>
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
