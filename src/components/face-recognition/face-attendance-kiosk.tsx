"use client";

import { CircleAlert, CircleCheck, Eye, LoaderCircle, ScanFace } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusPanel } from "@/components/ui/status-panel";
import { useFaceAttendanceScanner } from "@/hooks/use-face-attendance-scanner";
import { SHOW_FACE_DIAGNOSTICS } from "@/lib/face-recognition/config";
import type { ScannerState } from "@/lib/face-recognition/scanner-machine";

import { formatAttendanceTime } from "@/components/attendance-integration/attendance-time";

import { CameraViewport } from "./camera-viewport";

function promptFor(state: ScannerState) {
  switch (state.status) {
    case "initializing": return "Loading face models and starting the camera…";
    case "ready": return "Scanner ready.";
    case "searching": return state.guidance ?? "Look at the camera and hold still.";
    case "liveness": return "Blink slowly once.";
    case "verifying": return "Verifying identity…";
    case "recording": return "Recording attendance…";
    case "success": return state.result.outcome === "time_in" ? "Time in recorded." : "Time out recorded.";
    case "error": return state.message;
    case "cooldown": return "Next person, please wait…";
  }
}

function tone(state: ScannerState) {
  if (state.status === "success") return "success" as const;
  if (state.status === "error") return "error" as const;
  if (state.status === "liveness" || state.status === "verifying" || state.status === "recording") return "active" as const;
  return "neutral" as const;
}

function Scanner({ onClose }: { onClose: () => void }) {
  const { pause, retry, start, state, videoRef } = useFaceAttendanceScanner();
  const live = state.status !== "initializing" && !(state.status === "error" && state.fatal);
  const busy = state.status === "verifying" || state.status === "recording";
  const running = state.status !== "initializing" && state.status !== "ready" && !(state.status === "error" && state.fatal);

  return (
    <section aria-label="Face attendance scanner" className="space-y-4">
      <CameraViewport label="Camera preview" live={live} tone={tone(state)} videoRef={videoRef}>
        <span aria-live="polite" className="inline-flex items-center gap-2" role="status">
          {state.status === "initializing" || busy ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : null}
          {state.status === "liveness" ? <Eye aria-hidden="true" className="size-4" /> : null}
          {promptFor(state)}
        </span>
      </CameraViewport>

      {state.status === "success" ? (
        <div className="mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-emerald-600/30 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{state.result.employee?.firstName} {state.result.employee?.lastName}</p>
            <p className="text-sm">{state.result.employee?.employeeNumber} · {state.result.outcome === "time_in" ? "Time in" : "Time out"} at {formatAttendanceTime(state.result.outcome === "time_in" ? state.result.log?.timeIn : state.result.log?.timeOut)}</p>
            {SHOW_FACE_DIAGNOSTICS && state.result.distance !== null ? <p className="mt-1 text-xs opacity-80">Dev: match distance {state.result.distance.toFixed(3)}</p> : null}
          </div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive" role="alert">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">{state.fatal ? "Scanner unavailable" : state.kind === "not_recognized" ? "Face not recognized" : state.kind === "liveness_timeout" ? "Blink not detected" : state.kind === "network" ? "Connection problem" : state.kind === "service" ? "Attendance service rejected the scan" : "Attendance not recorded"}</p>
            <p className="text-sm">{state.message}</p>
            {SHOW_FACE_DIAGNOSTICS && !state.fatal && state.distance != null ? <p className="text-xs opacity-80">Dev: closest distance {state.distance.toFixed(3)}</p> : null}
          </div>
        </div>
      ) : null}

      {SHOW_FACE_DIAGNOSTICS && state.status === "liveness" ? (
        <p className="text-center text-xs text-muted-foreground">Dev: EAR {state.blink.lastEar?.toFixed(3) ?? "—"} · baseline {state.blink.baseline?.toFixed(3) ?? "—"} · phase {state.blink.phase}</p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        {state.status === "ready" ? <Button onClick={start} type="button"><ScanFace aria-hidden="true" />Start scanning</Button> : null}
        {state.status === "error" && state.fatal ? <Button onClick={retry} type="button">Try again</Button> : null}
        {running ? <Button disabled={busy} onClick={pause} type="button" variant="outline">Pause</Button> : null}
        <Button disabled={busy} onClick={onClose} type="button" variant="outline">Close scanner</Button>
      </div>
    </section>
  );
}

/**
 * Attendance kiosk for a supervised device signed in as HR Personnel. Employees do not choose
 * their name: the face is matched in the database after a blink challenge.
 */
export function FaceAttendanceKiosk() {
  const [open, setOpen] = useState(false);
  if (open) return <Scanner onClose={() => setOpen(false)} />;
  return (
    <StatusPanel
      action={<Button onClick={() => setOpen(true)} type="button"><ScanFace aria-hidden="true" />Open scanner</Button>}
      description="Opens the camera on this device. Each person looks at the camera and blinks once; attendance is recorded only for a registered, recognized face. No images are stored."
      kind="empty"
      title="Face attendance kiosk"
    />
  );
}
