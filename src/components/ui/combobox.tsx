"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary text shown under the label and included in search matching. */
  description?: string;
};

type ComboboxProps = {
  id: string;
  options: readonly ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  /** Submits the selected option value with native form data. */
  name?: string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
};

function matches(option: ComboboxOption, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return `${option.label} ${option.description ?? ""}`.toLocaleLowerCase().includes(needle);
}

/**
 * Searchable, keyboard-accessible single-select for long lists such as
 * employees or positions. Short, fixed option sets should use NativeSelect.
 */
export function Combobox({
  id,
  options,
  value,
  onValueChange,
  name,
  placeholder = "Type to search",
  emptyMessage = "No matches found.",
  disabled = false,
  required = false,
  className,
  ...aria
}: ComboboxProps) {
  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  return (
    <ComboboxPrimitive.Root<ComboboxOption>
      disabled={disabled}
      filter={(item, query) => matches(item, query)}
      isItemEqualToValue={(item, current) => item.value === current.value}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      items={options as ComboboxOption[]}
      name={name}
      onValueChange={(next) => onValueChange((next as ComboboxOption | null)?.value ?? null)}
      required={required}
      value={selected}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          "relative flex min-h-11 w-full items-center rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-3 has-[input[aria-invalid=true]]:ring-destructive/20 data-disabled:opacity-50 dark:bg-input/30",
          className,
        )}
      >
        <ComboboxPrimitive.Input
          className="h-full min-h-11 w-full min-w-0 rounded-lg border-0 bg-transparent py-2 pr-20 pl-3 text-base text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          id={id}
          placeholder={placeholder}
          {...aria}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          {selected && !disabled ? (
            <ComboboxPrimitive.Clear
              aria-label="Clear selection"
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </ComboboxPrimitive.Clear>
          ) : null}
          <ComboboxPrimitive.Trigger
            aria-label="Show options"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </ComboboxPrimitive.Trigger>
        </div>
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner className="z-50 outline-none" sideOffset={6}>
          <ComboboxPrimitive.Popup className="w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <ComboboxPrimitive.Empty className="px-3 py-4 text-sm text-muted-foreground empty:hidden">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-[min(20rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-0 data-empty:p-0">
              {(option: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  className="grid min-h-11 cursor-pointer grid-cols-[1.25rem_1fr] items-center gap-2 rounded-md px-2 py-2 text-base outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  key={option.value}
                  value={option}
                >
                  <ComboboxPrimitive.ItemIndicator className="col-start-1">
                    <Check aria-hidden="true" className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                  <span className="col-start-2 min-w-0">
                    <span className="block">{option.label}</span>
                    {option.description ? (
                      <span className="block text-sm text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
