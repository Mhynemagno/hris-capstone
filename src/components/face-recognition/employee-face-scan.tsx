"use client";

import { ScanFace } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useMyFaceRegistration } from "@/hooks/use-face-recognition";

import { FaceScanner } from "./face-attendance-kiosk";

/**
 * Self-service face attendance for the signed-in employee. The face is verified only against
 * the employee's own registration, so no HR login is needed.
 */
export function EmployeeFaceScan() {
  const registration = useMyFaceRegistration();
  const [open, setOpen] = useState(false);

  if (registration.isLoading) return <LoadingState label="Checking your face registration…" />;
  if (registration.error) return <ErrorState message={registration.error.message} />;
  if (!registration.data?.registered) {
    return <StatusPanel description="Your face is not registered yet. Ask HR to register it, then come back to record your attendance." kind="empty" title="Face registration needed" />;
  }
  if (open) return <FaceScanner mode="self" onClose={() => setOpen(false)} />;
  return (
    <StatusPanel
      action={<Button onClick={() => setOpen(true)} type="button"><ScanFace aria-hidden="true" />Open camera</Button>}
      description="Look at the camera. Your first scan of the day records time in; a later scan records time out. No photos are stored."
      kind="empty"
      title="Record attendance with your face"
    />
  );
}
