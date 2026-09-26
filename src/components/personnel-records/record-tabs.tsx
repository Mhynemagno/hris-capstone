"use client";

import { useRef, useSyncExternalStore, type KeyboardEvent } from "react";
import { Award, BookOpenCheck, GraduationCap, History, IdCard, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const RECORD_TABS = [
  { key: "official", label: "Official record" },
  { key: "service-history", label: "Service history" },
  { key: "qualifications", label: "Qualifications" },
  { key: "certifications", label: "Certifications" },
  { key: "training", label: "Training" },
] as const;

export type RecordTabKey = (typeof RECORD_TABS)[number]["key"];

const tabIcons: Record<RecordTabKey, LucideIcon> = {
  official: IdCard,
  "service-history": History,
  qualifications: GraduationCap,
  certifications: Award,
  training: BookOpenCheck,
};

/** The tab named in the URL, or the official record when it is missing or unknown. */
export function parseRecordTab(value: string | null): RecordTabKey {
  return RECORD_TABS.find((tab) => tab.key === value)?.key ?? "official";
}

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => typeof window.matchMedia === "function" && window.matchMedia(DESKTOP_QUERY).matches, () => false);
}

type RecordTabsProps = {
  active: RecordTabKey;
  onChange: (key: RecordTabKey) => void;
  idPrefix: string;
  /** "responsive" scrolls sideways on narrow screens and becomes a vertical module list on desktop. */
  orientation?: "horizontal" | "responsive";
  /** Optional record counts shown as badges beside each section. */
  counts?: Partial<Record<RecordTabKey, number>>;
};

/** Accessible tab bar (WAI-ARIA tabs pattern). */
export function RecordTabs({ active, onChange, idPrefix, orientation = "horizontal", counts }: RecordTabsProps) {
  const tabRefs = useRef(new Map<RecordTabKey, HTMLButtonElement>());
  const isDesktop = useIsDesktop();
  const vertical = orientation === "responsive" && isDesktop;

  function select(index: number) {
    const tab = RECORD_TABS[(index + RECORD_TABS.length) % RECORD_TABS.length]!;
    onChange(tab.key);
    tabRefs.current.get(tab.key)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: RECORD_TABS.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }

  const responsive = orientation === "responsive";

  return (
    <div
      aria-label="Personnel record sections"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={cn(
        "-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0",
        responsive ? "pb-1 lg:flex-col lg:overflow-visible lg:pb-0" : "border-b",
      )}
      role="tablist"
    >
      {RECORD_TABS.map((tab, index) => {
        const selected = tab.key === active;
        const Icon = tabIcons[tab.key];
        const count = counts?.[tab.key];
        return (
          <button
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            aria-selected={selected}
            className={cn(
              "min-h-11 shrink-0 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              responsive
                ? cn(
                  "flex items-center gap-2.5 rounded-xl border px-3.5 lg:w-full lg:border-transparent",
                  selected ? "border-primary/30 bg-primary/10 text-primary lg:border-primary/20" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground lg:bg-transparent",
                )
                : cn("border-b-2 px-4", selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"),
            )}
            id={`${idPrefix}-tab-${tab.key}`}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              if (element) tabRefs.current.set(tab.key, element);
              else tabRefs.current.delete(tab.key);
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {responsive ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
            <span className={responsive ? "flex-1 text-left" : undefined}>{tab.label}</span>
            {count ? (
              <span aria-hidden className={cn("min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
