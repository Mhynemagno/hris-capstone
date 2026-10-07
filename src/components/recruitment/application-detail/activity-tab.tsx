"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { notifySuccess } from "@/components/ui/toaster";
import { useAddApplicationRemark } from "@/hooks/use-recruitment";
import { formatDateTime } from "@/lib/format-date";
import type { ApplicationStatusHistory } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import { historyEntryLabel } from "../application-status-tracker";

export function ActivityTab({ applicationId, history }: { applicationId: string; history: ApplicationStatusHistory[] }) {
  const addRemark = useAddApplicationRemark();
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (addRemark.isPending) return;
    setError(null);
    if (!remark.trim()) { setError("Enter a remark."); return; }
    try {
      await addRemark.mutateAsync({ applicationId, remark: remark.trim() });
      setRemark("");
      notifySuccess("Remark added · applicant notified");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not add this remark.");
    }
  }

  return (
    <div className="space-y-5">
      <section aria-label="Add remark" className="space-y-3 rounded-lg border bg-card p-5">
        <FormField description="Record progress without changing the stage. The applicant sees each remark and is notified." error={error ?? undefined} htmlFor="application-remark" label="Remark">
          <Textarea id="application-remark" maxLength={2000} onChange={(event) => { setError(null); setRemark(event.target.value); }} rows={3} value={remark} />
        </FormField>
        <Button loading={addRemark.isPending} onClick={() => void save()} type="button" variant="outline">Add remark</Button>
      </section>
      <ol className="relative space-y-4 border-l pl-5">
        {history.toReversed().map((entry) => {
          const isRemark = entry.previous_status === entry.next_status;
          return (
            <li className="relative" key={entry.id}>
              <span aria-hidden="true" className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card", isRemark ? "bg-muted-foreground" : "bg-primary")} />
              <p className="text-base font-medium">{isRemark ? "Remark" : `Moved to ${historyEntryLabel(entry)}`}</p>
              {entry.note ? <p className="text-base text-secondary-foreground">{entry.note}</p> : null}
              <p className="text-sm text-muted-foreground">{formatDateTime(entry.created_at)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
