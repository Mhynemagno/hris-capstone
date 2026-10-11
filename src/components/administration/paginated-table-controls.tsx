import { StaffPager } from "@/components/staff-shell/ui/staff-table-card";

type PaginatedTableControlsProps = {
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  totalCount: number;
};

export function PaginatedTableControls({ onPageChange, page, pageSize, totalCount }: PaginatedTableControlsProps) {
  return <StaffPager noun="records" onPageChange={onPageChange} page={page} pageSize={pageSize} total={totalCount} />;
}
