"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: "Information we collect",
    body: <ul className="list-disc space-y-1 pl-5"><li>Your name, qualifier, birthdate, citizenship, sex, civil status and address.</li><li>Your email address and mobile number.</li><li>Your educational background.</li><li>The documents you upload for your application.</li></ul>,
  },
  {
    title: "How we use your information",
    body: <p>Your information is used only to evaluate your application, contact you about its status, and complete hiring requirements for the San Juan City Police Station.</p>,
  },
  {
    title: "How your information is protected",
    body: <p>Your data is kept confidential and stored securely within this system. Only authorized HR personnel and system administrators can access it, and every access and change is recorded. It is never sold or shared with third parties outside the recruitment process, except when required by law.</p>,
  },
  {
    title: "Retention",
    body: <p>Your information is kept only for as long as needed for recruitment and for record-keeping required by law. You may ask for your account and its data to be deleted.</p>,
  },
  {
    title: "Your rights",
    body: <p>Under the Data Privacy Act of 2012, you have the right to be informed, to access, to correct, and to object to the processing of your personal data, and to have it erased or blocked.</p>,
  },
];

/** Asks the visitor to accept the data privacy notice before continuing to sign in or apply. */
export function ApplyPrivacyNotice({ children, className, href }: { children: ReactNode; className?: string; href: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const checkboxId = useId();

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setAgreed(false); }}>
      <Dialog.Trigger className={className}>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-card text-card-foreground shadow-xl transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="border-b p-6">
            <Dialog.Title className="flex items-center gap-2 text-xl font-semibold">
              <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
              Data Privacy Notice
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Please read how the San Juan City Police Station handles your personal information before you apply.
            </Dialog.Description>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm leading-6">
            <p>The San Juan City Police Station respects your privacy and is committed to protecting your personal data in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173). By applying, you agree to the collection and use of your information as described below.</p>
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h3 className="text-base font-bold">{section.title}</h3>
                <div className="mt-1">{section.body}</div>
              </section>
            ))}
          </div>
          <div className="space-y-4 border-t p-6">
            <label className="flex items-start gap-3 text-sm font-medium" htmlFor={checkboxId}>
              <input checked={agreed} className="mt-0.5 size-4 accent-primary" id={checkboxId} onChange={(event) => setAgreed(event.target.checked)} type="checkbox" />
              I have read and agree to the Data Privacy Notice.
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close render={<Button type="button" variant="outline" />}>Cancel</Dialog.Close>
              <Button disabled={!agreed} onClick={() => router.push(href)} type="button">I Agree &amp; Continue</Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
