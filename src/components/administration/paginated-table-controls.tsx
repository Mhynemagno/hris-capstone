import { Button } from "@/components/ui/button";

type PaginatedTableControlsProps = {
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  totalCount: number;
};

export function PaginatedTableControls({ onPageChange, page, pageSize, totalCount }: PaginatedTableControlsProps) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <nav aria-label="Table pagination" className="flex items-center justify-between gap-3">
      <p aria-live="polite" className="text-sm text-muted-foreground">Page {page} of {pageCount}</p>
      <div className="flex items-center gap-2">
        <Button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button" variant="outline">Previous</Button>
        <Button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} type="button" variant="outline">Next</Button>
      </div>
    </nav>
  );
}
