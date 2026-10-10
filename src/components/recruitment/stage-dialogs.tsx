"use client";

import { useState } from "react";

import { BadgeNumberInput } from "@/components/ui/badge-number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { notifySuccess } from "@/components/ui/toaster";
import { useHireApplication, useRecordStageResult } from "@/hooks/use-recruitment";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import { needsStageDocument, RESULT_LABELS, type RecordableResult } from "@/lib/recruitment/stage-results";
import { hiringDecisionSchema, type ApplicationStatus } from "@/schemas/recruitment";

const errorText = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

type OpenProps = { open: boolean; onOpenChange: (open: boolean) => void };

const resultDescriptions: Record<RecordableResult, string> = {
  verified: "Confirms the submitted documents were checked.",
  scheduled: "Tells the applicant this stage has been scheduled.",
  passed: "Moves the applicant to the next stage.",
  failed: "This ends the application as Disqualified.",
};

/** Records Verified / Scheduled / Passed / Failed for the current stage; Passed and Failed need proof after Application Submission. */
export function StageResultDialog({ applicationId, onOpenChange, open, result, status }: OpenProps & { applicationId: string; status: ApplicationStatus; result: RecordableResult }) {
  const record = useRecordStageResult();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setNote(""); setFile(null); setError(null); }
  }
  const label = RESULT_LABELS[result];
  const documentRequired = needsStageDocument(status, result);
  const description = result === "passed" && status === "Final Evaluation" ? "The applicant becomes a Candidate (shortlisted)." : resultDescriptions[result];

  async function confirm() {
    if (record.isPending) return;
    setError(null);
    if (documentRequired && !file) {
      setError("Upload a supporting document for this result.");
      return;
    }
    try {
      await record.mutateAsync({ applicationId, result, note: note.trim() || undefined, file });
      notifySuccess(`${status}: ${label} · applicant notified`);
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause, "We could not record this result."));
    }
  }

  return (
    <Dialog onOpenChange={(next) => { if (!record.isPending) onOpenChange(next); }} open={open}>
      <DialogContent
        description={description}
        footer={<>
          <DialogClose render={<Button disabled={record.isPending} variant="outline" />}>Cancel</DialogClose>
          <Button loading={record.isPending} onClick={() => void confirm()} type="button" variant={result === "failed" ? "destructive" : "default"}>{`Mark as ${label}`}</Button>
        </>}
        title={`Mark ${status} as ${label}`}
      >
        <div className="space-y-4">
          {result === "passed" || result === "failed" ? (
            <FormField
              description={documentRequired ? "Required. Proof this stage was carried out, e.g. the result sheet (PDF or image, up to 10 MB)." : "Optional. PDF or image, up to 10 MB."}
              htmlFor="stage-document"
              label="Supporting document"
              required={documentRequired}
            >
              <Input accept="application/pdf,image/png,image/jpeg,image/webp" id="stage-document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
            </FormField>
          ) : null}
          <FormField description="Included in the applicant's notification." htmlFor="stage-note" label="Note to applicant">
            <Textarea id="stage-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
          </FormField>
          {error ? <p className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
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
