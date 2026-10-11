"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const sizes = { md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl" } as const;

export function StaffModal({ open, onClose, title, subtitle, icon, iconClassName, size = "lg", dark = false, children, footer, footerClassName }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; icon?: ReactNode; iconClassName?: string;
  size?: keyof typeof sizes; dark?: boolean; children: ReactNode; footer?: ReactNode; footerClassName?: string;
}) {
  return (
    <Dialog.Root onOpenChange={(next) => { if (!next) onClose(); }} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" />
        <Dialog.Popup className={cn("capstone-ui fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white font-sans text-slate-800 shadow-2xl", sizes[size])}>
          <div className={cn("flex items-center justify-between gap-3 border-b p-5", dark ? "border-slate-800 bg-[#0B132B]" : "border-slate-200 bg-slate-50")}>
            <div className="flex min-w-0 items-center gap-3">
              {icon ? <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", iconClassName)}>{icon}</span> : null}
              <div className="min-w-0">
                <Dialog.Title className={cn("text-sm font-bold", dark ? "text-white" : "text-slate-900")}>{title}</Dialog.Title>
                {subtitle ? <Dialog.Description className={cn("text-[11px]", dark ? "text-slate-300" : "text-slate-500")}>{subtitle}</Dialog.Description> : null}
              </div>
            </div>
            <Dialog.Close aria-label="Close" className={cn("rounded-lg p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", dark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-700")}>
              <X aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 text-xs">{children}</div>
          {footer ? <div className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4", footerClassName)}>{footer}</div> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
