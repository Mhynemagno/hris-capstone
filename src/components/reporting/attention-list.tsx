import Link from "next/link";
import { ChevronRight, CircleCheck, type LucideIcon } from "lucide-react";

export type AttentionItem = { key: string; label: string; count: number | null; href: string; icon: LucideIcon };

/** Open work first; zero-count rows fold into one quiet line. A count that failed to load shows "—". */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  const open = items.filter((item) => item.count === null || item.count > 0);
  const clear = items.filter((item) => item.count === 0);
  if (!open.length) {
    return <p className="flex items-center gap-2 px-5 py-4 text-base text-muted-foreground"><CircleCheck aria-hidden="true" className="size-4 text-success" />You&apos;re all caught up.</p>;
  }
  return (
    <div>
      <ul className="divide-y">
        {open.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link className="flex min-h-12 items-center gap-3 px-5 py-2 transition-colors hover:bg-muted" href={item.href}>
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-base">{item.label}</span>
                <span className="min-w-8 text-right text-base font-semibold tabular-nums">{item.count ?? "—"}</span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
      {clear.length ? (
        <p className="flex items-center gap-2 border-t px-5 py-3 text-sm text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-4 text-success" />
          All clear: {clear.map((item) => item.label.charAt(0).toLowerCase() + item.label.slice(1)).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
