import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { AccountMenu } from "./account-menu";

vi.mock("./sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

it("keeps account context and sign out reachable from the header", async () => {
  const user = userEvent.setup();
  render(<AccountMenu email="hr@example.com" roleLabel="HR Personnel" />);

  const trigger = screen.getByRole("button", {
    name: "Account menu for hr@example.com",
  });
  expect(trigger).toHaveClass("min-h-11");
  expect(trigger).toHaveClass("min-w-11");

  trigger.focus();
  await user.keyboard("{Enter}");

  expect(screen.getByText("HR Personnel")).toBeVisible();
  expect(screen.getByRole("button", { name: /^sign out$/i })).toBeVisible();
});
