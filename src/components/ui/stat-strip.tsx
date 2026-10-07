import Link from "next/link";
import type { ReactNode } from "react";

type Stat = { key: string; label: string; value: ReactNode; hint?: ReactNode; href?: string };

export function StatStrip({ items, label }: { label: string; items: Stat[] }) {
  return (
    <section aria-label={label} className="grid divide-y overflow-hidden rounded-lg border bg-card sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
      {items.map((item) => {
        const body = (
          <article aria-label={item.label} className="flex h-full flex-col gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="text-3xl font-semibold tabular-nums" data-numeric>{item.value}</p>
            {item.hint ? <p className="text-sm text-muted-foreground">{item.hint}</p> : null}
          </article>
        );
        return item.href
          ? <Link className="transition-colors hover:bg-muted focus-visible:outline-offset-[-3px]" href={item.href} key={item.key}>{body}</Link>
          : <div key={item.key}>{body}</div>;
      })}
    </section>
  );
}
