import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Pagination({ from, noun, onPageChange, page, pageCount, to, total }: { page: number; pageCount: number; total: number; from: number; to: number; noun: string; onPageChange: (page: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground tabular-nums">{total ? `${from}–${to} of ${total} ${noun}` : `0 ${noun}`}</p>
      <div className="flex gap-2">
        <Button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" type="button" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button>
        <Button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} size="sm" type="button" variant="outline">Next<ChevronRight aria-hidden="true" /></Button>
      </div>
    </nav>
  );
}
