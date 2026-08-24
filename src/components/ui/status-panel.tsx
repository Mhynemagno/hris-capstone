import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

type StatusPanelProps = {
  kind: "loading" | "empty" | "error";
  title: string;
  description: string;
  action?: ReactNode;
};

const statusIcons = {
  loading: LoaderCircle,
  empty: CircleCheck,
  error: CircleAlert,
};

export function StatusPanel({
  action,
  description,
  kind,
  title,
}: StatusPanelProps) {
  const Icon = statusIcons[kind];
  const role = kind === "error" ? "alert" : "status";

  return (
    <section
      aria-live={kind === "loading" ? "polite" : undefined}
      className="rounded-xl border border-border bg-card p-6 shadow-sm"
      role={role}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2 text-primary">
          <Icon
            aria-hidden="true"
            className={kind === "loading" ? "size-5 motion-safe:animate-spin" : "size-5"}
          />
        </div>
        <div className="space-y-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
