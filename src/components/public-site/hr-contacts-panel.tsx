"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useDeletePublicContact, useHrContacts, useReorderPublicContacts, useSavePublicContact } from "@/hooks/use-public-site";
import { moveId } from "@/lib/public-site/contacts";
import { contactKindLabel } from "@/schemas/public-site";

import { HrContactForm } from "./hr-contact-form";

export function HrContactsPanel() {
  const contacts = useHrContacts();
  const save = useSavePublicContact();
  const remove = useDeletePublicContact();
  const reorder = useReorderPublicContacts();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = save.isPending || remove.isPending || reorder.isPending;

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice(null);
    setActionError(null);
    try {
      await action();
      setNotice(success);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The change could not be saved.");
    }
  }

  function finishEditing(message: string) {
    setEditing(null);
    setActionError(null);
    setNotice(message);
  }

  if (contacts.isLoading) return <LoadingState label="Loading contacts…" />;
  if (contacts.error) return <ErrorState message={contacts.error.message} />;
  const rows = contacts.data ?? [];
  const ids = rows.map((contact) => contact.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-base text-muted-foreground">The landing page shows a Contact section only while at least one contact is visible. Entries appear in the order below.</p>
        {editing !== "new" ? (
          <Button onClick={() => { setEditing("new"); setNotice(null); }} type="button">
            <Plus aria-hidden="true" />
            Add contact
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
      {actionError ? <ErrorState message={actionError} /> : null}
      {editing === "new" ? <HrContactForm onCancel={() => setEditing(null)} onSaved={finishEditing} /> : null}
      {!rows.length && editing !== "new" ? (
        <StatusPanel
          description="Add the station's phone numbers, email, address, office hours, or Facebook page. The landing page shows a Contact section once one entry is visible."
          kind="empty"
          title="No contact details yet"
        />
      ) : null}
      <ul className="space-y-3">
        {rows.map((contact, index) => (
          <li key={contact.id}>
            {editing === contact.id ? (
              <HrContactForm contact={contact} onCancel={() => setEditing(null)} onSaved={finishEditing} />
            ) : (
              <article aria-labelledby={`hr-contact-${contact.id}`} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={contact.is_visible ? "default" : "outline"}>{contact.is_visible ? "Visible" : "Hidden"}</Badge>
                    <span className="text-sm text-muted-foreground">{contactKindLabel(contact.kind)}</span>
                  </div>
                  <h3 className="text-lg font-bold" id={`hr-contact-${contact.id}`}>{contact.label}</h3>
                  <p className="text-base whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]">{contact.value}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button aria-label={`Move ${contact.label} up`} disabled={busy || index === 0} onClick={() => void run(() => reorder.mutateAsync(moveId(ids, contact.id, -1)), `${contact.label} moved up.`)} size="icon" type="button" variant="outline">
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button aria-label={`Move ${contact.label} down`} disabled={busy || index === rows.length - 1} onClick={() => void run(() => reorder.mutateAsync(moveId(ids, contact.id, 1)), `${contact.label} moved down.`)} size="icon" type="button" variant="outline">
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button aria-label={`Edit ${contact.label}`} disabled={busy} onClick={() => { setEditing(contact.id); setNotice(null); }} type="button" variant="outline">
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    aria-label={`${contact.is_visible ? "Hide" : "Show"} ${contact.label}`}
                    disabled={busy}
                    onClick={() => void run(
                      () => save.mutateAsync({ contactId: contact.id, input: { kind: contact.kind, label: contact.label, value: contact.value, isVisible: !contact.is_visible } }),
                      contact.is_visible ? `${contact.label} is now hidden from the landing page.` : `${contact.label} is now shown on the landing page.`,
                    )}
                    type="button"
                    variant="outline"
                  >
                    {contact.is_visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    {contact.is_visible ? "Hide" : "Show"}
                  </Button>
                  {confirmingDeleteId !== contact.id ? (
                    <Button aria-label={`Delete ${contact.label}`} disabled={busy} onClick={() => setConfirmingDeleteId(contact.id)} type="button" variant="destructive">
                      <Trash2 aria-hidden="true" />
                      Delete
                    </Button>
                  ) : null}
                </div>
                {confirmingDeleteId === contact.id ? (
                  <div aria-label={`Confirm deleting ${contact.label}`} className="flex basis-full flex-wrap items-center gap-2" role="group">
                    <p className="text-sm">Delete this contact? It disappears from the landing page.</p>
                    <Button
                      onClick={() => {
                        setConfirmingDeleteId(null);
                        void run(() => remove.mutateAsync(contact.id), `${contact.label} was deleted.`);
                      }}
                      type="button"
                      variant="destructive"
                    >
                      Confirm delete
                    </Button>
                    <Button onClick={() => setConfirmingDeleteId(null)} type="button" variant="outline">Keep contact</Button>
                  </div>
                ) : null}
              </article>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
