import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { DataTable, type DataTableColumn } from "./data-table";
import { FilterBar } from "./filter-bar";

type Row = { id: string; name: string; score: number };
const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Applicant", sortable: true, cell: (row) => <a href={`/x/${row.id}`}>{row.name}</a> },
  { key: "score", header: "AI match", sortable: true, align: "right", hideBelow: "md", cell: (row) => row.score },
  { key: "actions", header: "Actions", cell: () => <button type="button">Menu</button> },
];
const rows: Row[] = [{ id: "1", name: "Ana", score: 80 }];

describe("DataTable", () => {
  beforeEach(() => push.mockReset());

  it("marks the sorted column and asks for the next sort", async () => {
    const onSortChange = vi.fn();
    render(<DataTable caption="Applications" columns={columns} empty="None" getRowKey={(r) => r.id} loadingLabel="Loading applications…" onSortChange={onSortChange} rows={rows} sort={{ key: "name", direction: "asc" }} />);
    expect(screen.getByRole("columnheader", { name: /Applicant/ })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: /AI match/ })).toHaveAttribute("aria-sort", "none");
    await userEvent.click(screen.getByRole("button", { name: "Sort by Applicant" }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "name", direction: "desc" });
  });

  it("navigates on row click but not when clicking a control inside the row", async () => {
    render(<DataTable caption="Applications" columns={columns} empty="None" getRowHref={(r) => `/hr/applications/${r.id}`} getRowKey={(r) => r.id} loadingLabel="Loading…" rows={rows} />);
    await userEvent.click(screen.getByRole("cell", { name: "80" }));
    expect(push).toHaveBeenCalledWith("/hr/applications/1");
    push.mockReset();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("shows loading, error and empty rows", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<DataTable caption="A" columns={columns} empty="Nothing here" getRowKey={(r) => r.id} isLoading loadingLabel="Loading applications…" rows={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading applications…");
    rerender(<DataTable caption="A" columns={columns} empty="Nothing here" error="Boom" getRowKey={(r) => r.id} loadingLabel="Loading…" onRetry={onRetry} rows={[]} />);
    await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<DataTable caption="A" columns={columns} empty="Nothing here" getRowKey={(r) => r.id} loadingLabel="Loading…" rows={[]} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  it("removes single filters and clears all", async () => {
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<FilterBar chips={[{ key: "stage", label: "Stage: Interview", onRemove }]} onClearAll={onClearAll}><span>controls</span></FilterBar>);
    await userEvent.click(screen.getByRole("button", { name: "Remove filter Stage: Interview" }));
    expect(onRemove).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalled();
  });
});
