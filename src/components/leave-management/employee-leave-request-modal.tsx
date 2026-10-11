"use client";

import { FileSignature } from "lucide-react";

import { StaffModal } from "@/components/staff-shell/ui/staff-modal";

import { EmployeeLeaveRequestForm } from "./employee-leave";

/** "File Leave Application" (Capstone UI empleave.html): the existing request form, validation and submission, in a modal. */
export function EmployeeLeaveRequestModal({ open, onOpenChange, onSubmitted }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmitted?: (message: string) => void }) {
  const close = () => onOpenChange(false);
  return (
    <StaffModal icon={<FileSignature aria-hidden="true" className="size-3.5" />} iconClassName="bg-blue-100 text-blue-700" onClose={close} open={open} subtitle="San Juan CPS Personnel HR Department" title="File Leave Application">
      <EmployeeLeaveRequestForm onCancel={close} onSubmitted={(message) => { onSubmitted?.(message); close(); }} />
    </StaffModal>
  );
}
