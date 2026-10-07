"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ReactNode } from "react";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "center" | "end" }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align={align} className="z-50" sideOffset={6}>
        <PopoverPrimitive.Popup className="w-72 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}
