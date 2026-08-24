type MetricCardProps = {
  label: string;
  value: string | number;
  description?: string;
};

export function MetricCard({ description, label, value }: MetricCardProps) {
  return (
    <article
      aria-label={label}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </article>
  );
}
