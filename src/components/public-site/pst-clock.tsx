"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

const pstFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "14:05:09" in Philippine Standard Time, whatever the visitor's own time zone. */
export function formatPst(date: Date) {
  return pstFormatter.format(date);
}

function subscribeToSeconds(onTick: () => void) {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
}

/** A live PST clock. The server renders a placeholder, so the server and client HTML always match. */
export function PstClock() {
  const time = useSyncExternalStore(subscribeToSeconds, () => formatPst(new Date()), () => null);
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-sidebar-ring">
      <Clock aria-hidden="true" className="size-4" />
      <span>PST</span>
      <time className="tabular-nums">{time ?? "--:--:--"}</time>
    </p>
  );
}
