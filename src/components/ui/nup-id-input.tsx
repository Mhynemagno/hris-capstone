"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";

export function formatNupId(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 6 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}

export function NupIdInput({ defaultValue, ...props }: Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "defaultValue"> & { defaultValue?: string | null }) {
  const [value, setValue] = useState(formatNupId(defaultValue ?? ""));
  return <Input autoComplete="off" inputMode="numeric" maxLength={10} placeholder="YYYY-MM-DD" {...props} onChange={(event) => setValue(formatNupId(event.target.value))} type="text" value={value} />;
}
