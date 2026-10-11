import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/administration/admin-page", () => ({
  AdminPage: ({ children, description, title }: { children: React.ReactNode; description: string; title: string }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

vi.mock("@/components/administration/administration-workspaces", () => ({
  AuditLogsWorkspace: () => <p>Read-only audit history</p>,
  DepartmentsWorkspace: () => <button type="button">Add unit / section</button>,
  RanksWorkspace: () => <button type="button">Add rank</button>,
  SettingsWorkspace: () => <button type="button">Edit organization settings</button>,
  UnitStationsWorkspace: () => <button type="button">Add unit / station</button>,
  UsersWorkspace: () => <button type="button">Invite account</button>,
}));

import AuditLogsPage from "./audit-logs/page";
import DepartmentsPage from "./departments/page";
import RanksPage from "./ranks/page";
import SettingsPage from "./settings/page";
import UnitStationsPage from "./unit-stations/page";
import UsersPage from "./users/page";

describe("SysAd administrative route pages", () => {
  it.each([
    ["Manage Accounts", "Search, filter, invite, and manage every account and its access role.", "Invite account", UsersPage],
    ["Units and Sections", "Maintain the station’s unit / section reference data.", "Add unit / section", DepartmentsPage],
    ["Units and Stations", "Maintain the sub-stations and units used for personnel assignments.", "Add unit / station", UnitStationsPage],
    ["Ranks", "Maintain the police ranks available to every unit / section.", "Add rank", RanksPage],
    ["System Settings", "Configure organization information without exposing secrets.", "Edit organization settings", SettingsPage],
    ["Audit Log", "Review the immutable history of administrative changes.", "Read-only audit history", AuditLogsPage],
  ])("keeps the %s heading, caption, and representative workspace", (title, description, workspaceText, Page) => {
    render(<Page />);

    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByText(workspaceText)).toBeInTheDocument();
  });
});
