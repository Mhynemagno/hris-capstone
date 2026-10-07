"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
};

/** A blocking yes/no question. Errors from the confirmed action are shown inside the dialog. */
export function ConfirmDialog({ cancelLabel = "Cancel", children, confirmLabel, description, error, onConfirm, onOpenChange, open, pending = false, title, tone = "default" }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root onOpenChange={(next) => { if (!pending) onOpenChange(next); }} open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-5 text-popover-foreground shadow-xl transition-[opacity,scale] duration-[180ms] ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">{description}</AlertDialog.Description>
          {children ? <div className="mt-4">{children}</div> : null}
          {error ? <p className="mt-4 rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <AlertDialog.Close disabled={pending} render={<Button variant="outline" />}>{cancelLabel}</AlertDialog.Close>
            <Button loading={pending} onClick={() => void onConfirm()} type="button" variant={tone === "danger" ? "danger" : "primary"}>{confirmLabel}</Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
