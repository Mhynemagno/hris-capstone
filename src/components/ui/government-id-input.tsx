"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { formatGovernmentId, GOVERNMENT_ID_FORMATS, type GovernmentIdKind } from "@/lib/government-ids";

type GovernmentIdInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "defaultValue" | "placeholder"> & {
  kind: GovernmentIdKind;
  defaultValue?: string | null;
};

/**
 * Digits-only government ID box: the format is shown inside it and dashes are added as you type.
 * No maxLength: the browser would cut pasted text with separators before formatGovernmentId caps the digits.
 */
export function GovernmentIdInput({ kind, defaultValue, ...props }: GovernmentIdInputProps) {
  const format = GOVERNMENT_ID_FORMATS[kind];
  const [value, setValue] = useState(() => formatGovernmentId(kind, defaultValue));
  return (
    <Input
      autoComplete="off"
      className="h-11 tabular-nums"
      inputMode="numeric"
      placeholder={format.placeholder}
      {...props}
      onChange={(event) => setValue(formatGovernmentId(kind, event.target.value))}
      value={value}
    />
  );
}
