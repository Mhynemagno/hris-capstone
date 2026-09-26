"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";

/** Formats typed or pasted text as a PNP badge number: up to six digits, dash after the first (0-00000). */
export function formatBadgeNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  return digits.length > 1 ? `${digits[0]}-${digits.slice(1)}` : digits;
}

type BadgeNumberInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "defaultValue"> & {
  defaultValue?: string | null;
};

/** Text input that only accepts digits and inserts the badge-number dash as the user types. */
export function BadgeNumberInput({ defaultValue, ...props }: BadgeNumberInputProps) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <Input
      autoComplete="off"
      className="h-11 tabular-nums"
      inputMode="numeric"
      maxLength={7}
      pattern="\d-\d{5}"
      placeholder="0-00000"
      {...props}
      onChange={(event) => setValue(formatBadgeNumber(event.target.value))}
      type="text"
      value={value}
    />
  );
}
