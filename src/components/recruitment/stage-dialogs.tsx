"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { BadgeNumberInput } from "@/components/ui/badge-number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { notifySuccess } from "@/components/ui/toaster";
import { useHireApplication, useTransitionApplicationStatus } from "@/hooks/use-recruitment";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import { allowedNextStatuses } from "@/lib/recruitment/application-stages";
import { hiringDecisionSchema, type ApplicationStatus } from "@/schemas/recruitment";

const errorText = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

type OpenProps = { open: boolean; onOpenChange: (open: boolean) => void };

function forwardStages(status: ApplicationStatus) {
  return allowedNextStatuses[status].filter((next) => next !== "Not Selected");
}

export function MoveStageDialog({ applicationId, initialStage, onOpenChange, open, status }: OpenProps & { applicationId: string; status: ApplicationStatus; initialStage?: ApplicationStatus }) {
  const transition = useTransitionApplicationStatus();
  const options = forwardStages(status);
  const defaultStage = initialStage ?? (options.length === 1 ? options[0]! : "");
  const [stage, setStage] = useState<string>(defaultStage);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Start fresh each time the dialog opens, without an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setStage(defaultStage); setNote(""); setError(null); }
  }

  async function confirm() {
    if (!stage || transition.isPending) return;
    setError(null);
    try {
      await transition.mutateAsync({ applicationId, nextStatus: stage as ApplicationStatus, note: note.trim() || undefined });
      notifySuccess(`Moved to ${stage} · applicant notified`);
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause, "We could not update this application."));
    }
  }

  return (
    <Dialog onOpenChange={(next) => { if (!transition.isPending) onOpenChange(next); }} open={open}>
      <DialogContent
        description={`Currently ${status}. Only the stages allowed next are listed.`}
        footer={<>
          <DialogClose render={<Button disabled={transition.isPending} variant="outline" />}>Cancel</DialogClose>
          <Button disabled={!stage} loading={transition.isPending} onClick={() => void confirm()} type="button">{stage ? `Move to ${stage}` : "Move"}</Button>
        </>}
        title="Move to next stage"
      >
        <div className="space-y-4">
          <RadioGroup legend="Next stage" name="next-stage" onValueChange={setStage} options={options.map((value) => ({ value, label: value }))} value={stage} />
          <FormField description="Included in the applicant's notification." htmlFor="move-note" label="Note to applicant">
            <Textarea id="move-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
          </FormField>
          {error ? <p className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NotSelectedDialog({ applicationId, onOpenChange, open }: OpenProps & { applicationId: string }) {
  const transition = useTransitionApplicationStatus();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setNote(""); setError(null); }
  }

  async function confirm() {
    if (transition.isPending) return;
    setError(null);
    try {
      await transition.mutateAsync({ applicationId, nextStatus: "Not Selected", note: note.trim() || undefined });
      notifySuccess("Marked as not selected · applicant notified");
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause, "We could not update this application."));
    }
  }

  return (
    <ConfirmDialog confirmLabel="Mark as not selected" description="This ends the application. The applicant will be notified." error={error} onConfirm={confirm} onOpenChange={onOpenChange} open={open} pending={transition.isPending} title="Mark as not selected?" tone="danger">
      <FormField description="Optional. Included in the applicant's notification." htmlFor="not-selected-note" label="Note to applicant">
        <Textarea id="not-selected-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
      </FormField>
    </ConfirmDialog>
  );
}

export function HireDialog({ applicantNumber, applicationId, onOpenChange, open }: OpenProps & { applicationId: string; applicantNumber: number | null | undefined }) {
  const hire = useHireApplication();
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setError(null);
  }

  async function submit(form: HTMLFormElement) {
    if (hire.isPending) return;
    setError(null);
    const data = new FormData(form);
    const input = hiringDecisionSchema.safeParse({ applicationId, badgeNumber: String(data.get("badgeNumber") ?? ""), note: String(data.get("hireNote") || "") || undefined });
    if (!input.success) { setError(input.error.issues[0]?.message ?? "Enter the badge number."); return; }
    try {
      await hire.mutateAsync(input.data);
      notifySuccess("Applicant hired · employee record created");
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause, "We could not hire this applicant."));
    }
  }

  return (
    <Dialog onOpenChange={(next) => { if (!hire.isPending) onOpenChange(next); }} open={open}>
      <DialogContent description="Creates the employee record, sends an account activation email, and notifies the applicant." title="Hire applicant">
        <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="hire-applicant-number" label="Applicant number">
              <Input id="hire-applicant-number" readOnly value={formatApplicantNumber(applicantNumber) ?? "Not available"} />
            </FormField>
            <FormField description="6 digits, e.g. 1-23456." htmlFor="hire-badge-number" label="Badge number" required>
              <BadgeNumberInput id="hire-badge-number" name="badgeNumber" required />
            </FormField>
          </div>
          <FormField htmlFor="hire-note" label="Notes">
            <Textarea id="hire-note" maxLength={2000} name="hireNote" />
          </FormField>
          {error ? <p className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button disabled={hire.isPending} variant="outline" />}>Cancel</DialogClose>
            <Button loading={hire.isPending} type="submit">Hire applicant</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
