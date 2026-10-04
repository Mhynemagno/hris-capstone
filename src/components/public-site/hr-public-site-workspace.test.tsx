import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("./hr-announcements-panel", () => ({ HrAnnouncementsPanel: () => <p>Announcements panel</p> }));
vi.mock("./hr-contacts-panel", () => ({ HrContactsPanel: () => <p>Contacts panel</p> }));

import { HrPublicSiteWorkspace } from "./hr-public-site-workspace";

it("switches between the Announcements and Contacts tabs by click and arrow keys", async () => {
  const user = userEvent.setup();
  render(<HrPublicSiteWorkspace />);
  expect(screen.getByRole("tab", { name: "Announcements" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Announcements panel");

  await user.click(screen.getByRole("tab", { name: "Contacts" }));
  expect(screen.getByRole("tab", { name: "Contacts" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel", { name: "Contacts" })).toHaveTextContent("Contacts panel");

  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("tab", { name: "Announcements" })).toHaveFocus();
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Announcements panel");
});
