import { Skeleton } from "@/components/ui/skeleton";

export default function ProtectedLoading() {
  return (
    <div className="space-y-8" aria-live="polite" aria-label="Loading workspace">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-6 w-full max-w-xl" />
      </div>
      <Skeleton className="h-44 w-full max-w-2xl rounded-xl" />
    </div>
  );
}
