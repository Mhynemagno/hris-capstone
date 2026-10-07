import { render, screen } from "@testing-library/react";
import { CalendarDays, FileText, Fingerprint } from "lucide-react";
import { expect, it } from "vitest";

import { AttentionList } from "./attention-list";

const base = [
  { key: "apps", label: "Applications awaiting review", count: 3, href: "/hr/applications?stage=Submitted", icon: FileText },
  { key: "leave", label: "Leave requests for approval", count: 0, href: "/hr/leave-requests?status=pending", icon: CalendarDays },
  { key: "unmatched", label: "Unmatched attendance IDs", count: null, href: "/hr/attendance/unmatched", icon: Fingerprint },
];

it("lists open work as links, shows unknown counts as a dash, and folds clear rows into one line", () => {
  render(<AttentionList items={base} />);
  expect(screen.getByRole("link", { name: /Applications awaiting review.*3/ })).toHaveAttribute("href", "/hr/applications?stage=Submitted");
  expect(screen.getByRole("link", { name: /Unmatched attendance IDs.*—/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Leave requests/ })).not.toBeInTheDocument();
  expect(screen.getByText("All clear: leave requests for approval")).toBeInTheDocument();
});

it("says so when everything is caught up", () => {
  render(<AttentionList items={base.map((item) => ({ ...item, count: 0 }))} />);
  expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("keeps acronyms intact in the all-clear line", () => {
  render(<AttentionList items={[{ ...base[0]!, count: 1 }, { ...base[2]!, count: 0 }]} />);
  expect(screen.getByText("All clear: unmatched attendance IDs")).toBeInTheDocument();
});
