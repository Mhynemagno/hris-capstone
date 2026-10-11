"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { FaceScanner } from "@/components/face-recognition/face-attendance-kiosk";

const clockFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", year: "numeric" });

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="space-y-1 text-center">
      <p className="font-mono text-3xl font-black tracking-wider text-amber-400">{clockFormat.format(now)}</p>
      <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">{dayFormat.format(now)}</p>
    </div>
  );
}

/**
 * The full-screen attendance kiosk launched from Attendance Logs (Capstone UI attendance.html, PDF p. 33).
 * It replaces the old Kiosk page. Closing it unmounts the scanner, which stops the camera.
 */
export function AttendanceKioskOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog.Root onOpenChange={(next) => { if (!next) onClose(); }} open={open}>
      <Dialog.Portal>
        <Dialog.Popup aria-label="Attendance kiosk" className="capstone-ui fixed inset-0 z-50 flex flex-col justify-between gap-6 overflow-y-auto bg-slate-950 p-4 font-sans text-white sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-amber-400/50 bg-blue-900 shadow-md">
                <Image alt="" className="size-8 object-contain" height={32} src="/san-juan-police-logo.png" width={32} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold tracking-widest text-amber-400 uppercase">San Juan City Police Station</h2>
                <p className="text-xs font-medium text-slate-400">Biometric Face Recognition Attendance Kiosk</p>
              </div>
            </div>
            <button className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400" onClick={onClose} type="button">
              <X aria-hidden="true" className="size-3.5" /><span>Exit Kiosk Mode</span>
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6">
            <div className="w-full space-y-3 rounded-3xl border-4 border-dashed border-blue-500/60 bg-slate-900/80 p-4 shadow-2xl">
              <div className="text-center">
                <p className="text-sm font-bold text-white">Look at the Camera</p>
                <p className="text-[11px] text-slate-400">Position face inside frame for instant scan</p>
              </div>
              <div className="workspace rounded-2xl bg-background p-3 text-foreground">
                {open ? <FaceScanner mode="kiosk" onClose={onClose} /> : null}
              </div>
            </div>
            <LiveClock />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-emerald-500 motion-safe:animate-ping" />
              <span className="font-bold text-slate-200">Device Terminal Active</span>
            </span>
            <span>System Status: <span className="font-bold text-emerald-400">Operational</span></span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
