import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { RoleLanding } from "./role-landing";

describe("RoleLanding", () => {
  it("renders an informational management page without mutation controls", () => {
    render(<RoleLanding config={ROLE_CONFIG.management} />);

    expect(
      screen.getByRole("heading", { name: /management workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/what you can do here/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create|edit|delete|approve/i }),
    ).not.toBeInTheDocument();
  });
});
