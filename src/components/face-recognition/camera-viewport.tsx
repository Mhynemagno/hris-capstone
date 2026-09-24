import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

type CameraViewportProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Whether a live preview is showing. The video element stays mounted so the stream can attach. */
  live: boolean;
  tone?: "neutral" | "active" | "success" | "error";
  label: string;
  children?: ReactNode;
};

const toneRing = {
  neutral: "border-white/70",
  active: "border-primary",
  success: "border-emerald-500",
  error: "border-destructive",
};

/** Mirrored front-camera preview with a face guide. Nothing is recorded or uploaded from it. */
export function CameraViewport({ children, label, live, tone = "neutral", videoRef }: CameraViewportProps) {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-xl border bg-muted">
      <video
        aria-label={label}
        autoPlay
        className={cn("size-full -scale-x-100 object-cover", live ? "opacity-100" : "opacity-0")}
        muted
        playsInline
        ref={videoRef}
      />
      {live ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={cn("h-3/4 aspect-[3/4] rounded-[50%] border-4 border-dashed transition-colors", toneRing[tone])} />
        </div>
      ) : null}
      {children ? <div className="absolute inset-x-0 bottom-0 bg-background/90 p-3 text-center text-sm font-medium backdrop-blur-sm">{children}</div> : null}
    </div>
  );
}
