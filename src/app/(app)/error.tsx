"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function ProtectedError({ reset }: { reset: () => void }) {
  return (
    <div className="max-w-xl space-y-4 py-10">
      <ErrorState message="We could not load this workspace. Please try again." />
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
