"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ShieldCheck } from "lucide-react";

import { PrivacyNoticeBody } from "@/components/recruitment/privacy-sections";

/** The login page's "Privacy Policy" link: the Data Privacy Notice to read, without the apply consent step. */
export function PrivacyPolicyDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">Privacy Policy</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="capstone-ui fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="border-b border-slate-100 p-6">
            <Dialog.Title className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <ShieldCheck aria-hidden="true" className="size-5 text-blue-800" />
              Data Privacy Notice
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-xs text-slate-500">
              How the San Juan City Police Station handles your personal information.
            </Dialog.Description>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm leading-6 text-slate-700">
            <PrivacyNoticeBody />
          </div>
          <div className="flex justify-end border-t border-slate-100 p-4">
            <Dialog.Close className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2">Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
