import type { ReactNode } from "react";

type PageHeaderProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({
  action,
  description,
  eyebrow,
  id,
  meta,
  title,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl space-y-2">
        {eyebrow ? (
          <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" id={id}>
          {title}
        </h1>
        {description ? (
          <p className="text-base leading-7 text-muted-foreground sm:text-lg">
            {description}
          </p>
        ) : null}
        {meta}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
