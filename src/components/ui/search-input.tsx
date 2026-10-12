"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { useSearchDraft } from "@/hooks/use-search-draft";
import { cn } from "@/lib/utils";

const staffInput = "w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-9 text-xs font-medium transition-all focus:ring-2 focus:ring-blue-600 focus:outline-none [&::-webkit-search-cancel-button]:hidden";

/**
 * The one search box used by every list. Typing stays instant; `onChange` receives the trimmed
 * text once typing pauses (or on Enter), so the list is queried once per search, not per key.
 * `variant="staff"` matches the Capstone UI table toolbars.
 */
export function SearchInput({ className, delay = 300, id: externalId, label, onChange, placeholder, value, variant = "default" }: {
  label: string;
  /** Set when a visible label elsewhere (e.g. FormField) names the box; the built-in hidden label is then skipped. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
  variant?: "default" | "staff";
}) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const search = useSearchDraft(value, onChange, delay);
  const staff = variant === "staff";
  const inputProps = {
    id,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => search.change(event.target.value),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); search.flush(); } },
    placeholder: placeholder ?? label,
    type: "search" as const,
    value: search.draft,
    autoComplete: "off",
  };
  return (
    <div className={cn("relative w-full", staff ? "sm:w-64" : "sm:w-72", className)}>
      {externalId ? null : <label className="sr-only" htmlFor={id}>{label}</label>}
      <Search aria-hidden="true" className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2", staff ? "left-3.5 size-3 text-slate-500" : "left-3 size-4 text-muted-foreground")} />
      {staff ? <input className={staffInput} {...inputProps} /> : <Input className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden" {...inputProps} />}
      {search.draft ? (
        <button aria-label="Clear search" className={cn("absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded", staff ? "text-slate-500 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none" : "text-muted-foreground hover:text-foreground")} onClick={search.clear} type="button">
          <X aria-hidden="true" className={staff ? "size-3.5" : "size-4"} />
        </button>
      ) : null}
    </div>
  );
}
