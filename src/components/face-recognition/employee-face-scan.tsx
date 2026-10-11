"use client";

import { Camera, ScanFace } from "lucide-react";
import { useState } from "react";

import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useMyFaceRegistration } from "@/hooks/use-face-recognition";

import { FaceScanner } from "./face-attendance-kiosk";

function ScannerBody({ onClose }: { onClose: () => void }) {
  const registration = useMyFaceRegistration();
  if (registration.isLoading) return <LoadingState label="Checking your face registration…" />;
  if (registration.error) return <ErrorState message={registration.error.message} />;
  if (!registration.data?.registered) {
    return <StatusPanel description="Your face is not registered yet. Ask HR to register it, then come back to record your attendance." kind="empty" title="Face registration needed" />;
  }
  return <FaceScanner mode="self" onClose={onClose} />;
}

/**
 * Biometric panel of the Attendance page (empfacere.html). The face is verified only against the
 * employee's own registration, so no HR login is needed. The scanner lives in the modal and is
 * mounted only while it is open, so closing it (or leaving the page) stops the camera.
 */
export function EmployeeFaceScan() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section aria-labelledby="biometric-heading" className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-2xl bg-linear-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl md:flex-row">
        <ScanFace aria-hidden="true" className="pointer-events-none absolute -right-8 -bottom-8 size-44 text-white opacity-10" />
        <div className="relative z-10 space-y-2 text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-[11px] font-bold tracking-wider text-blue-300 uppercase"><ScanFace aria-hidden="true" className="size-3.5" />Biometric Recognition System</span>
          <h2 className="text-xl font-extrabold tracking-tight" id="biometric-heading">Record Attendance with Face Verification</h2>
          <p className="max-w-lg text-xs leading-relaxed text-slate-300">Ensure your camera is active and well-lit. Position your face inside the frame for duty Time-In or Time-Out logging. Your first scan of the day records time in; a later scan records time out. No photos are stored.</p>
        </div>
        <button aria-haspopup="dialog" className={`${staffButton.primary} relative z-10 shrink-0 !bg-amber-500 px-6 py-3.5 font-extrabold !text-slate-950 hover:!bg-amber-400`} onClick={() => setOpen(true)} type="button"><Camera aria-hidden="true" className="size-4" />Scan Attendance Now</button>
      </section>
      <StaffModal dark icon={<ScanFace aria-hidden="true" className="size-4" />} iconClassName="bg-white/10 text-amber-400" onClose={() => setOpen(false)} open={open} size="xl" subtitle="Look at the camera and hold still." title="Facial Verification Scanner">
        <div className="p-5"><ScannerBody onClose={() => setOpen(false)} /></div>
      </StaffModal>
    </>
  );
}
