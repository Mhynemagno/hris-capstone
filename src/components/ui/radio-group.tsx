"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { useId } from "react";

type Option = { value: string; label: string; description?: string };

export function RadioGroup({ legend, name, onValueChange, options, value }: { legend: string; name: string; value: string; onValueChange: (value: string) => void; options: Option[] }) {
  const legendId = useId();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id={legendId}>{legend}</p>
      <RadioGroupPrimitive aria-labelledby={legendId} className="space-y-1.5" name={name} onValueChange={(next) => onValueChange(String(next))} value={value}>
        {options.map((option) => (
          <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary-subtle" key={option.value}>
            <Radio.Root className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-input data-checked:border-primary" value={option.value}>
              <Radio.Indicator className="size-2 rounded-full bg-primary" />
            </Radio.Root>
            <span className="space-y-0.5">
              <span className="block text-base font-medium">{option.label}</span>
              {option.description ? <span className="block text-sm text-muted-foreground">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </RadioGroupPrimitive>
    </div>
  );
}
