type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <p aria-live="polite" role="status" className="text-sm text-muted-foreground">
      {label}
    </p>
  );
}
