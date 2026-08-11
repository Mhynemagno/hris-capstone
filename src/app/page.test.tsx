import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home", () => {
  it("links visitors to sign in and future job openings", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: /view job openings/i }),
    ).toHaveAttribute("href", "/jobs");
  });
});
