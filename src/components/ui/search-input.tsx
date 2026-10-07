"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

export function SearchInput({ delay = 300, label, onChange, placeholder, value }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; delay?: number }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Follow the URL when it changes from outside (e.g. "Clear all"), without an effect.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  function update(next: string) {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next.trim()), delay);
  }
  return (
    <div className="relative w-full sm:w-72">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pr-9 pl-9" id={id} onChange={(event) => update(event.target.value)} placeholder={placeholder ?? label} type="search" value={draft} />
      {draft ? (
        <button aria-label="Clear search" className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground" onClick={() => { clearTimeout(timer.current); setDraft(""); onChange(""); }} type="button">
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
