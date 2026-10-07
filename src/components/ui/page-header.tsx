import type { ReactNode } from "react";

type PageHeaderProps = {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Secondary actions, e.g. a "More" dropdown, shown before the primary action. */
  secondaryActions?: ReactNode;
  /** Small line above the title, e.g. a back link. */
  eyebrow?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ action, description, eyebrow, id, meta, secondaryActions, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between ws:border-b-0 ws:pb-0">
      <div className="max-w-3xl space-y-2 ws:space-y-1">
        {eyebrow}
        <h1 className="text-3xl font-bold tracking-tight ws:text-2xl" id={id}>
          {title}
        </h1>
        {description ? (
          <p className="text-base leading-7 text-muted-foreground ws:leading-5">{description}</p>
        ) : null}
        {meta}
      </div>
      {secondaryActions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondaryActions}
          {action}
        </div>
      ) : action ? (
        <div className="shrink-0">{action}</div>
      ) : null}
    </header>
  );
}
