import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./pst-clock", () => ({ PstClock: () => <span>PST 14:05:09</span> }));

import { PortalHeader } from "./portal-header";

describe("PortalHeader", () => {
  it("shows the government top bar, both logos, the station name, section links and the login menu", () => {
    render(<PortalHeader showContact />);
    expect(screen.getByText("Republic of the Philippines • Philippine National Police")).toBeVisible();
    expect(screen.getByText("PST 14:05:09")).toBeVisible();
    expect(screen.getByAltText("San Juan City Police Station logo")).toBeInTheDocument();
    expect(screen.getByAltText("Bagong Pilipinas logo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /San Juan City Police Station HRIS/ })).toHaveAttribute("href", "/");
    const sections = screen.getByRole("navigation", { name: "Page sections" });
    expect(within(sections).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#portals", "#announcements", "#about", "#why-join", "#faqs", "#contact"]);
    expect(screen.getByRole("button", { name: /^login$/i })).toBeVisible();
  });

  it("leaves out the Contact link while there is no contact to show", () => {
    render(<PortalHeader showContact={false} />);
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).queryByRole("link", { name: "Contact" })).not.toBeInTheDocument();
  });
});
