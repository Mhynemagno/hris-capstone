"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const sizes = { lg: "max-w-lg", xl: "max-w-xl" } as const;

/** Capstone UI right-hand panel (dep.html #deploymentModal, promotions.html #criteriaDrawer). */
export function StaffSlideOver({ open, onClose, title, subtitle, size = "lg", children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; size?: keyof typeof sizes; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <Dialog.Root onOpenChange={(next) => { if (!next) onClose(); }} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" />
        <Dialog.Popup className={cn("capstone-ui fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white font-sans text-slate-800 shadow-2xl", sizes[size])}>
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-6">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-black text-slate-900">{title}</Dialog.Title>
              {subtitle ? <Dialog.Description className="text-xs text-slate-500">{subtitle}</Dialog.Description> : null}
            </div>
            <Dialog.Close aria-label="Close" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <X aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </div>
          <div aria-label={`${title} content`} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 text-xs font-semibold text-slate-700" tabIndex={0}>{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">{footer}</div> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
