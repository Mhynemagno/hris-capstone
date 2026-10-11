import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminPage from "./page";

describe("AdminPage", () => {
  it("renders the page-49 System Administration control grid without a fake justification form", () => {
    render(<AdminPage />);

    expect(screen.getByRole("heading", { level: 1, name: "System Administration" })).toBeInTheDocument();
    expect(screen.getByText("Manage secure access, organizational records, and system controls for the station.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People and Access" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Station Organization" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System Oversight" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /manage accounts/i })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: /review approvals/i })).toHaveAttribute("href", "/admin/profile-change-requests");
    expect(screen.getByRole("link", { name: /units and sections/i })).toHaveAttribute("href", "/admin/departments");
    expect(screen.getByRole("link", { name: /units and stations/i })).toHaveAttribute("href", "/admin/unit-stations");
    expect(screen.getByRole("link", { name: /^ranks/i })).toHaveAttribute("href", "/admin/ranks");
    expect(screen.getByRole("link", { name: /attendance integration/i })).toHaveAttribute("href", "/admin/integrations/attendance");
    expect(screen.getByRole("link", { name: /audit log/i })).toHaveAttribute("href", "/admin/audit-logs");
    expect(screen.getByRole("link", { name: /system settings/i })).toHaveAttribute("href", "/admin/settings");
    expect(screen.getByText(/recorded in the station audit trail/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /administrator remarks/i })).not.toBeInTheDocument();
  });
});
