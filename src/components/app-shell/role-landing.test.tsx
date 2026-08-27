import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { RoleLanding } from "./role-landing";

describe("RoleLanding", () => {
  it("links to the role's implemented workflows without stale future-work copy", () => {
    render(<RoleLanding config={ROLE_CONFIG.management} />);

    expect(
      screen.getByRole("heading", { name: /management workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/what you can do here/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/reports");
    expect(screen.queryByText(/next approved module/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create|edit|delete|approve/i }),
    ).not.toBeInTheDocument();
  });
});
