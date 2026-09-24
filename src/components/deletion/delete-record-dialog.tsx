"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Ban, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useDeleteRecord, useDeletionImpact } from "@/hooks/use-deletion";
import type { DeletableEntityType, DeletionCount } from "@/queries/deletion";

type AlternativeAction = {
  /** e.g. "Deactivate instead" — the non-destructive path offered when deletion is blocked or unwanted. */
  label: string;
  onSelect: () => void | Promise<void>;
};

type DeleteRecordDialogProps = {
  entityType: DeletableEntityType;
  /** The record to delete; the dialog is open while this is not null. */
  entityId: string | number | null;
  /** Human noun used in headings, e.g. "department". */
  noun: string;
  onClose: () => void;
  onDeleted?: () => void;
  alternative?: AlternativeAction;
};

function formatCounts(items: DeletionCount[]) {
  return items.map((item) => (
    <li key={item.label}>
      <span className="font-semibold tabular-nums">{item.count}</span> {item.label}
    </li>
  ));
}

/**
 * Two-step, server-checked deletion. The impact preview comes from the
 * database (get_deletion_impact) so the counts and rules shown here are the
 * same ones enforced when the delete runs.
 */
export function DeleteRecordDialog({ alternative, entityId, entityType, noun, onClose, onDeleted }: DeleteRecordDialogProps) {
  const open = entityId !== null;
  const impact = useDeletionImpact(entityType, entityId);
  const remove = useDeleteRecord(entityType);
  const [alternativePending, setAlternativePending] = useState(false);
  const [alternativeError, setAlternativeError] = useState<string | null>(null);
  const data = impact.data;
  const busy = remove.isPending || alternativePending;

  function close() {
    if (busy) return;
    remove.reset();
    setAlternativeError(null);
    onClose();
  }

  async function confirmDelete() {
    if (entityId === null) return;
    try {
      await remove.mutateAsync(entityId);
      onDeleted?.();
      onClose();
    } catch {
      // The error is rendered from mutation state; refresh the preview in case dependencies changed.
      void impact.refetch();
    }
  }

  async function runAlternative() {
    if (!alternative) return;
    setAlternativeError(null);
    setAlternativePending(true);
    try {
      await alternative.onSelect();
      onClose();
    } catch (cause) {
      setAlternativeError(cause instanceof Error ? cause.message : "That action could not be completed.");
    } finally {
      setAlternativePending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-xl transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <AlertDialog.Title className="flex items-center gap-2 font-heading text-xl font-semibold">
            <Trash2 aria-hidden="true" className="size-5 text-destructive" />
            {data ? `Delete ${data.label}?` : `Delete ${noun}?`}
          </AlertDialog.Title>

          <div className="mt-4 space-y-4 text-base">
            {impact.isLoading ? (
              <p aria-live="polite" className="text-muted-foreground">Checking what depends on this {noun}…</p>
            ) : impact.error ? (
              <p className="font-medium text-destructive" role="alert">{impact.error.message}</p>
            ) : data?.canDelete ? (
              <>
                <AlertDialog.Description>
                  This permanently removes the {noun}. It cannot be undone. The audit log keeps a record of who deleted it and when.
                </AlertDialog.Description>
                {data.removes.length ? (
                  <div className="rounded-lg bg-muted px-4 py-3">
                    <p className="font-semibold">Also removed with it</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">{formatCounts(data.removes)}</ul>
                  </div>
                ) : null}
                {data.alternative ? <p className="text-muted-foreground">Prefer to keep it? {data.alternative}</p> : null}
              </>
            ) : data ? (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3" role="alert">
                <p className="flex items-center gap-2 font-semibold text-destructive">
                  <Ban aria-hidden="true" className="size-4" />
                  This {noun} can&apos;t be deleted
                </p>
                <AlertDialog.Description render={<div />} className="space-y-2">
                  {data.blockers.length ? (
                    <div>
                      <p>Other records still depend on it, and deleting it would break their history:</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">{formatCounts(data.blockers)}</ul>
                    </div>
                  ) : null}
                  {data.reasons.map((reason) => <p key={reason}>{reason}</p>)}
                  {data.alternative ? <p className="font-medium">{data.alternative}</p> : null}
                </AlertDialog.Description>
              </div>
            ) : null}

            {remove.error ? <p className="font-medium text-destructive" role="alert">{remove.error.message}</p> : null}
            {alternativeError ? <p className="font-medium text-destructive" role="alert">{alternativeError}</p> : null}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close render={<Button disabled={busy} type="button" variant="outline" />}>Cancel</AlertDialog.Close>
            {alternative ? (
              <Button disabled={busy} onClick={() => void runAlternative()} type="button" variant="secondary">
                {alternativePending ? "Working…" : alternative.label}
              </Button>
            ) : null}
            <Button
              disabled={!data?.canDelete || busy}
              onClick={() => void confirmDelete()}
              type="button"
              variant="destructive"
            >
              {remove.isPending ? "Deleting…" : `Delete ${noun}`}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
