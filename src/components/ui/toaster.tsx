"use client";

import { Toaster as Sonner, toast } from "sonner";

/** One toaster for the workspace. Success toasts are polite status messages and never take focus. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "workspace rounded-lg border border-border bg-card text-foreground shadow-lg text-base",
          description: "text-sm text-muted-foreground",
        },
      }}
    />
  );
}

/** sonner only marks its container as live; each toast also carries role="status" so it reads as a status message. */
export function notifySuccess(message: string) {
  toast.success(<span role="status">{message}</span>);
}
