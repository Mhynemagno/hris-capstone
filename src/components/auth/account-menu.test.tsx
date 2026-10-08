import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { AccountMenu } from "./account-menu";

it("keeps account context reachable from the header", async () => {
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
  expect(screen.queryByRole("button", { name: /^sign out$/i })).not.toBeInTheDocument();
});
