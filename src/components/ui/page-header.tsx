import type { ReactNode } from "react";

type PageHeaderProps = {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({
  action,
  description,
  id,
  meta,
  title,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" id={id}>
          {title}
        </h1>
        {description ? (
          <p className="text-base leading-7 text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
