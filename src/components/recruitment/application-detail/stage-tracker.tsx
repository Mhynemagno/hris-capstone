import { Check, X } from "lucide-react";

import { PIPELINE_STAGES, trackerPosition } from "@/lib/recruitment/application-stages";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/schemas/recruitment";

export function StageTracker({ endedAt, status }: { status: ApplicationStatus; endedAt: ApplicationStatus | null }) {
  const { outcome, reached } = trackerPosition(status, endedAt);
  return (
    <div>
      <p className="text-sm text-muted-foreground md:hidden">Stage {reached + 1} of {PIPELINE_STAGES.length} · {status}</p>
      <ol aria-label="Application stages" className="hidden items-center gap-1 md:flex">
        {PIPELINE_STAGES.map((stage, index) => {
          const done = index < reached || (index === reached && outcome === "hired");
          const current = index === reached && outcome !== "hired";
          const stopped = current && outcome === "not-selected";
          const revising = current && outcome === "needs-revision";
          return (
            <li aria-current={current ? "step" : undefined} className="flex min-w-0 flex-1 items-center gap-1.5" key={stage}>
              <span aria-hidden="true" className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-[10px]", done && "border-primary bg-primary text-primary-foreground", current && !stopped && !revising && "border-primary text-primary ring-2 ring-primary/20", stopped && "border-destructive bg-destructive text-white", revising && "border-warning text-warning", !done && !current && "border-input text-muted-foreground")}>
                {done ? <Check className="size-3" /> : stopped ? <X className="size-3" /> : index + 1}
              </span>
              <span className={cn("truncate text-xs", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{stage}</span>
              {stopped ? <span className="sr-only">(not selected at this stage)</span> : null}
              {index < PIPELINE_STAGES.length - 1 ? <span aria-hidden="true" className={cn("h-px flex-1", index < reached ? "bg-primary" : "bg-border")} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
