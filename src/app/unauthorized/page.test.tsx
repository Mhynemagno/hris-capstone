import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UnauthorizedPage from "./page";

describe("UnauthorizedPage", () => {
  it("explains the denial and offers a return to sign in", () => {
    render(<UnauthorizedPage />);

    expect(
      screen.getByRole("heading", { name: /access denied/i }),
    ).toBeInTheDocument();
    const returnLink = screen.getByRole("link", {
      name: /return to sign in/i,
    });

    expect(returnLink).toHaveAttribute("href", "/login");
    expect(returnLink.closest("button")).toBeNull();
  });
});
