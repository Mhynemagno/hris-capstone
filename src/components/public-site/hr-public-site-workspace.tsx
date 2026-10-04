"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { HrAnnouncementsPanel } from "./hr-announcements-panel";
import { HrContactsPanel } from "./hr-contacts-panel";

const TABS = [
  { key: "announcements", label: "Announcements" },
  { key: "contacts", label: "Contacts" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Announcements and Contacts tabs (WAI-ARIA tabs pattern, like RecordTabs). */
export function HrPublicSiteWorkspace() {
  const [active, setActive] = useState<TabKey>("announcements");
  const tabRefs = useRef(new Map<TabKey, HTMLButtonElement>());

  function select(index: number) {
    const tab = TABS[(index + TABS.length) % TABS.length]!;
    setActive(tab.key);
    tabRefs.current.get(tab.key)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }

  return (
    <div className="space-y-6">
      <div aria-label="Public portal content" className="flex gap-1 border-b" role="tablist">
        {TABS.map((tab, index) => {
          const selected = tab.key === active;
          return (
            <button
              aria-controls={selected ? `public-site-panel-${tab.key}` : undefined}
              aria-selected={selected}
              className={cn(
                "min-h-11 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              id={`public-site-tab-${tab.key}`}
              key={tab.key}
              onClick={() => setActive(tab.key)}
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
      <div aria-labelledby={`public-site-tab-${active}`} id={`public-site-panel-${active}`} role="tabpanel" tabIndex={0}>
        {active === "announcements" ? <HrAnnouncementsPanel /> : <HrContactsPanel />}
      </div>
    </div>
  );
}
