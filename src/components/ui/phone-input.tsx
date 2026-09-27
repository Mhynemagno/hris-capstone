"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { toPhilippineMobile } from "@/schemas/personnel-records";

/**
 * Keeps typed or pasted text to the +639XXXXXXXXX shape: only digits after a single
 * leading "+", the local "09…" start becomes "+639…", and at most 13 characters.
 */
export function formatPhilippineMobile(value: string) {
  const plus = value.trimStart().startsWith("+");
  let digits = value.replace(/\D/g, "");
  if (!plus && digits.startsWith("09")) digits = `63${digits.slice(1)}`;
  const formatted = plus || digits.startsWith("63") ? `+${digits}` : digits;
  return formatted.slice(0, 13);
}

type PhoneInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "defaultValue"> & {
  defaultValue?: string | null;
};

/** Philippine mobile number input (+639XXXXXXXXX). A saved 09XXXXXXXXX value is shown in the +639 format. */
export function PhoneInput({ defaultValue, ...props }: PhoneInputProps) {
  const [value, setValue] = useState(() => toPhilippineMobile(defaultValue).slice(0, 13));

  return (
    <Input
      autoComplete="tel"
      className="h-11 tabular-nums"
      inputMode="tel"
      maxLength={13}
      placeholder="+639XXXXXXXXX"
      {...props}
      onChange={(event) => setValue(formatPhilippineMobile(event.target.value))}
      type="tel"
      value={value}
    />
  );
}
