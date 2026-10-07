import { X } from "lucide-react";
import type { ReactNode } from "react";

type Chip = { key: string; label: string; onRemove: () => void };

export function FilterBar({ children, chips = [], onClearAll }: { children: ReactNode; chips?: Chip[]; onClearAll?: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">{children}</div>
      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-subtle py-0.5 pr-1 pl-2 text-sm text-primary" key={chip.key}>
              {chip.label}
              <button aria-label={`Remove filter ${chip.label}`} className="grid size-5 place-items-center rounded hover:bg-primary/10" onClick={chip.onRemove} type="button"><X aria-hidden="true" className="size-3.5" /></button>
            </span>
          ))}
          {onClearAll ? <button className="text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={onClearAll} type="button">Clear all</button> : null}
        </div>
      ) : null}
    </div>
  );
}
