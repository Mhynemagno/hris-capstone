"use client";

import { useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export const RECORD_TABS = [
  { key: "official", label: "Official record" },
  { key: "service-history", label: "Service history" },
  { key: "qualifications", label: "Qualifications" },
  { key: "certifications", label: "Certifications" },
  { key: "training", label: "Training" },
] as const;

export type RecordTabKey = (typeof RECORD_TABS)[number]["key"];

/** The tab named in the URL, or the official record when it is missing or unknown. */
export function parseRecordTab(value: string | null): RecordTabKey {
  return RECORD_TABS.find((tab) => tab.key === value)?.key ?? "official";
}

type RecordTabsProps = {
  active: RecordTabKey;
  onChange: (key: RecordTabKey) => void;
  idPrefix: string;
};

/** Accessible tab bar (WAI-ARIA tabs pattern) that scrolls sideways on narrow screens. */
export function RecordTabs({ active, onChange, idPrefix }: RecordTabsProps) {
  const tabRefs = useRef(new Map<RecordTabKey, HTMLButtonElement>());

  function select(index: number) {
    const tab = RECORD_TABS[(index + RECORD_TABS.length) % RECORD_TABS.length]!;
    onChange(tab.key);
    tabRefs.current.get(tab.key)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: RECORD_TABS.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }

  return (
    <div aria-label="Personnel record sections" className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0" role="tablist">
      {RECORD_TABS.map((tab, index) => {
        const selected = tab.key === active;
        return (
          <button
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            aria-selected={selected}
            className={cn(
              "min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
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
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
