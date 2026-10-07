type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  if (!onRetry) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {message}
      </p>
    );
  }
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <span>{message}</span>
      <button className="font-medium underline underline-offset-4" onClick={onRetry} type="button">Try again</button>
    </div>
  );
}
