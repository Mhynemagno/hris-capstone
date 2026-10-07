import userEvent from "@testing-library/user-event";
import { act, render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { SearchInput } from "./search-input";
import { StatStrip } from "./stat-strip";
import { TabPanel, Tabs } from "./tabs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/hr",
  useSearchParams: () => new URLSearchParams(""),
}));

describe("workspace kit", () => {
  it("shows totals and moves between pages", async () => {
    const onPageChange = vi.fn();
    render(<Pagination from={26} noun="applications" onPageChange={onPageChange} page={2} pageCount={3} to={50} total={60} />);
    expect(screen.getByText("26–50 of 60 applications")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables page buttons at the ends", () => {
    render(<Pagination from={1} noun="rows" onPageChange={() => undefined} page={1} pageCount={1} to={3} total={3} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("debounces search and clears it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onChange = vi.fn();
    render(<SearchInput label="Search applications" onChange={onChange} value="" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search applications" }), "ana");
    expect(onChange).not.toHaveBeenCalledWith("ana");
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(onChange).toHaveBeenLastCalledWith("ana");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    vi.useRealTimers();
  });

  it("switches tabs and shows counts", async () => {
    const onValueChange = vi.fn();
    render(
      <Tabs items={[{ value: "a", label: "Overview" }, { value: "b", label: "Documents", count: 8 }]} label="Application sections" onValueChange={onValueChange} value="a">
        <TabPanel value="a">First</TabPanel>
        <TabPanel value="b">Second</TabPanel>
      </Tabs>,
    );
    expect(screen.getByRole("tablist", { name: "Application sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Documents.*8/ })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("First");
    await userEvent.click(screen.getByRole("tab", { name: /Documents/ }));
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("renders an empty state with its action", () => {
    render(<EmptyState action={<Link href="/hr/jobs/new">New job posting</Link>} description="Create one to start." title="No job postings yet" />);
    expect(screen.getByRole("status")).toHaveTextContent("No job postings yet");
    expect(screen.getByRole("link", { name: "New job posting" })).toBeInTheDocument();
  });

  it("labels each stat and links it", () => {
    render(<StatStrip items={[{ key: "p", label: "Personnel", value: 160, href: "/hr/employees" }]} label="Today" />);
    expect(screen.getByRole("link", { name: /Personnel/ })).toHaveAttribute("href", "/hr/employees");
    expect(screen.getByRole("article", { name: "Personnel" })).toHaveTextContent("160");
  });
});
