import { Pagination } from "@/components/ui/pagination";

type PaginatedTableControlsProps = {
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  totalCount: number;
};

export function PaginatedTableControls({ onPageChange, page, pageSize, totalCount }: PaginatedTableControlsProps) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount ? (page - 1) * pageSize + 1 : 0;
  const to = totalCount ? Math.min(page * pageSize, totalCount) : 0;

  return <Pagination from={from} noun="records" onPageChange={onPageChange} page={page} pageCount={pageCount} to={to} total={totalCount} />;
}
