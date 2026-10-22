"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { notifySuccess } from "@/components/ui/toaster";
import { useReactivateApplicantAccount, useReopenApplicationForResubmission, useSendApplicantCredentials } from "@/hooks/use-applicant-portal";

const errorText = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

/**
 * HR account help for an applicant who must resubmit (Final Revisions PDF p. 15): reactivate a
 * deactivated account, or email new credentials (a password-reset link to the existing reset page).
 */
export function ApplicantAccountActions({ userId, email, active }: { userId: string; email: string | null; active: boolean }) {
  const reactivate = useReactivateApplicantAccount();
  const send = useSendApplicantCredentials();
  const [error, setError] = useState<string | null>(null);

  async function reactivateAccount() {
    if (reactivate.isPending) return;
    setError(null);
    try {
      await reactivate.mutateAsync(userId);
      notifySuccess("Account reactivated. The applicant can sign in again.");
    } catch (cause) {
      setError(errorText(cause, "We could not reactivate this account."));
    }
  }

  async function sendCredentials() {
    if (!email || send.isPending) return;
    setError(null);
    try {
      await send.mutateAsync(email);
      notifySuccess(`New credentials sent to ${email}.`);
    } catch (cause) {
      setError(errorText(cause, "We could not send new credentials."));
    }
  }

  return (
    <section aria-label="Account actions" className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {active ? "The account can sign in." : "The account is deactivated and cannot sign in. Reactivate it so the applicant can resubmit."}
      </p>
      <div className="flex flex-wrap gap-2">
        {active ? null : <Button loading={reactivate.isPending} onClick={() => void reactivateAccount()} type="button">Reactivate account</Button>}
        <Button disabled={!email || !active} loading={send.isPending} onClick={() => void sendCredentials()} title={!active ? "Reactivate the account first." : undefined} type="button" variant="outline">Send new credentials</Button>
      </div>
      {error ? <ErrorState message={error} /> : null}
    </section>
  );
}

/** Moves a Not Selected application back to Application Submission so the applicant can resubmit documents. */
export function ReopenApplicationButton({ applicationId }: { applicationId: string }) {
  const reopen = useReopenApplicationForResubmission();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (reopen.isPending) return;
    setError(null);
    try {
      await reopen.mutateAsync({ applicationId, note: note.trim() || undefined });
      notifySuccess("Application reopened · applicant notified");
      setOpen(false);
    } catch (cause) {
      setError(errorText(cause, "We could not reopen this application."));
    }
  }

  return (
    <>
      <Button onClick={() => { setNote(""); setError(null); setOpen(true); }} type="button" variant="outline">Reopen for resubmission</Button>
      <Dialog onOpenChange={(next) => { if (!reopen.isPending) setOpen(next); }} open={open}>
        <DialogContent
          description="The application returns to Application Submission. The applicant updates their documents and you review them again. The history is kept."
          footer={<>
            <DialogClose render={<Button disabled={reopen.isPending} variant="outline" />}>Cancel</DialogClose>
            <Button loading={reopen.isPending} onClick={() => void confirm()} type="button">Reopen application</Button>
          </>}
          title="Reopen for resubmission"
        >
          <div className="space-y-4">
            <FormField description="Optional. The applicant sees this note." htmlFor="reopen-note" label="Note to applicant">
              <Textarea id="reopen-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
            </FormField>
            {error ? <ErrorState message={error} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
