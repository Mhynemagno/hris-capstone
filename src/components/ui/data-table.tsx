"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { nextSort, type SortState } from "@/lib/workspace/table";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  hideBelow?: "md" | "lg";
  className?: string;
};

type DataTableProps<T> = {
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowHref?: (row: T) => string | null;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  isLoading?: boolean;
  loadingLabel: string;
  error?: string | null;
  onRetry?: () => void;
  empty: ReactNode;
  footer?: ReactNode;
};

const hideClass = { md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const;
const INTERACTIVE = "a, button, input, select, textarea, label, [role=menuitem], [role=menu]";

export function DataTable<T>({ caption, columns, empty, error, footer, getRowHref, getRowKey, isLoading, loadingLabel, onRetry, onSortChange, rows, sort }: DataTableProps<T>) {
  const router = useRouter();

  function onRowClick(event: MouseEvent<HTMLTableRowElement>, href: string | null | undefined) {
    if (!href || (event.target as HTMLElement).closest(INTERACTIVE)) return;
    if (event.metaKey || event.ctrlKey) { window.open(href, "_blank", "noopener"); return; }
    router.push(href);
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base" data-slot="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-[1] border-b bg-muted">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const ariaSort = !column.sortable ? undefined : active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none";
                const Icon = active ? (sort!.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th aria-sort={ariaSort} className={cn("h-10 px-4 text-xs font-medium whitespace-nowrap text-muted-foreground", column.align === "right" && "text-right", column.hideBelow && hideClass[column.hideBelow])} key={column.key} scope="col">
                    {column.sortable && onSortChange && sort ? (
                      <button aria-label={`Sort by ${column.header}`} className={cn("inline-flex items-center gap-1 rounded hover:text-foreground", active && "text-foreground")} onClick={() => onSortChange(nextSort(sort, column.key))} type="button">
                        {column.header}<Icon aria-hidden="true" className="size-3.5" />
                      </button>
                    ) : column.key === "actions" ? <span className="sr-only">{column.header}</span> : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <>
                <tr><td className="sr-only" colSpan={columns.length}><span aria-live="polite" role="status">{loadingLabel}</span></td></tr>
                {Array.from({ length: 6 }, (_, index) => (
                  <tr aria-hidden="true" className="h-11" key={index}>
                    {columns.map((column) => <td className={cn("px-4", column.hideBelow && hideClass[column.hideBelow])} key={column.key}><Skeleton className="h-4 w-3/4" /></td>)}
                  </tr>
                ))}
              </>
            ) : error ? (
              <tr><td className="p-4" colSpan={columns.length}><ErrorState message={error} onRetry={onRetry} /></td></tr>
            ) : rows.length ? rows.map((row) => {
              const href = getRowHref?.(row);
              return (
                <tr className={cn("h-11 transition-colors hover:bg-muted/60", href && "cursor-pointer")} key={getRowKey(row)} onClick={(event) => onRowClick(event, href)}>
                  {columns.map((column) => (
                    <td className={cn("px-4 py-2 align-middle", column.align === "right" && "text-right", column.hideBelow && hideClass[column.hideBelow], column.className)} key={column.key}>{column.cell(row)}</td>
                  ))}
                </tr>
              );
            }) : (
              <tr><td colSpan={columns.length}>{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
