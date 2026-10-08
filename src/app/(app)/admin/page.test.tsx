import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminPage from "./page";

describe("AdminPage", () => {
  it("groups the administration controls into station-ready work areas", () => {
    render(<AdminPage />);

    expect(screen.getByRole("heading", { level: 1, name: "System administration" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People and access" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Station organization" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System oversight" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage accounts/i })).toHaveAttribute("href", "/admin/users");
  });
});
