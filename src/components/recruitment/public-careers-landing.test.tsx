import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

const mocks = vi.hoisted(() => ({ announcements: vi.fn(), jobs: vi.fn() }));

vi.mock("@/hooks/use-recruitment", () => ({ usePublishedJobs: mocks.jobs }));
vi.mock("@/hooks/use-public-site", () => ({
  usePublishedAnnouncements: mocks.announcements,
}));

import { PublicCareersLanding } from "./public-careers-landing";

const announcementId = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
const loaded = <T,>(data: T) => ({ data, error: null, isLoading: false });

function openTab(name: string | RegExp) {
  fireEvent.click(screen.getByRole("tab", { name }));
  return screen.getByRole("tabpanel");
}

describe("PublicCareersLanding", () => {
  beforeEach(() => {
    mocks.announcements.mockReturnValue(loaded([
      { id: announcementId, title: "Road safety advisory", summary: "Expect road works near the station.", category: "advisory", published_at: "2026-10-03T02:00:00Z" },
    ]));
    mocks.jobs.mockReturnValue(loaded({
      rows: [{ closes_on: "2026-10-31", created_at: "2026-09-01T00:00:00Z", description: "Serve the community through visible patrol work.", id: 7, location: "San Juan City", published_at: "2026-09-02T00:00:00Z", title: "Patrol Officer" }],
    }));
  });

  it("uses the revised public navigation, ceremony hero, and Contact Us destination", () => {
    render(<PublicCareersLanding />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "The official page of San Juan City Police Station - To serve and protect" })).toBeVisible();
    expect(screen.getByTestId("ceremony-hero-image")).toHaveAttribute("src", expect.stringContaining("sjcp-ceremony.webp"));
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([["Home", "#hero"], ["About", "#hub"], ["Contact Us", "#contact"]]);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["About PNP", "Advisories & News", "Frequently Asked Questions (FAQ)", "Recruitment Openings"]);
    expect(screen.getByRole("tab", { name: "About PNP" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Contact Us" })).toBeVisible();
    expect(screen.getByText("Emergency Hotline 911")).toBeVisible();
    expect(screen.getByAltText("San Juan City Police Station logo")).toBeInTheDocument();
    expect(screen.getByText(/Data Privacy Act of 2012/)).toBeInTheDocument();
  });

  it("opens the role picker from LOGIN and links each role to its login", async () => {
    render(<PublicCareersLanding />);
    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Select User Role" });
    expect(within(dialog).getByRole("link", { name: /HR \/ Employee Portal/ })).toHaveAttribute("href", "/login?as=employee");
    expect(within(dialog).getByRole("link", { name: /Applicant Portal/ })).toHaveAttribute("href", "/login?as=applicant");
  });

  it("shows the station overview, vision, mission and the About PNP accordions", () => {
    render(<PublicCareersLanding />);
    const about = screen.getByRole("tabpanel");
    expect(within(about).getByRole("heading", { name: "San Juan City Station" })).toBeVisible();
    expect(within(about).getByRole("heading", { name: "Vision" })).toBeVisible();
    expect(within(about).getByRole("heading", { name: "Mission" })).toBeVisible();
    expect([...about.querySelectorAll("details > summary")].map((summary) => summary.textContent)).toEqual(["PNP Core Values", "PNP Regional Offices", "NCRPO District Offices", "PNP Rank Structure"]);
    expect(within(about).getByText("1. Maka-Diyos")).toBeInTheDocument();
    expect(within(about).getByText(/Police Executive Master Sergeant/)).toBeInTheDocument();
  });

  it("lists published announcements under Advisories & News with a Read more link", () => {
    render(<PublicCareersLanding />);
    const news = openTab("Advisories & News");
    expect(within(news).getByRole("heading", { name: "Road safety advisory" })).toBeVisible();
    expect(within(news).getByText("Advisory")).toBeVisible();
    expect(within(news).getByText("October 3, 2026")).toBeVisible();
    expect(within(news).getByRole("link", { name: "Read more about Road safety advisory" })).toHaveAttribute("href", `/announcements/${announcementId}`);
  });

  it("says so when there are no announcements", () => {
    mocks.announcements.mockReturnValue(loaded([]));
    render(<PublicCareersLanding />);
    expect(within(openTab("Advisories & News")).getByText("No announcements right now.")).toBeVisible();
  });

  it("answers the FAQs in native details elements, naming every required document", () => {
    render(<PublicCareersLanding />);
    const faq = openTab(/Frequently Asked Questions/);
    expect(faq.querySelectorAll("details > summary")).toHaveLength(3);
    expect(within(faq).getByText("Who can apply for recruitment in San Juan City Police Station?")).toBeInTheDocument();
    for (const { label } of APPLICANT_PROFILE_DOCUMENT_KINDS) expect(faq.textContent).toContain(label);
    expect(faq.querySelector("button")).toBeNull();
  });

  it("lists recruitment openings with View details and sends Track Status to the applicant login", () => {
    render(<PublicCareersLanding />);
    const recruitment = openTab("Recruitment Openings");
    expect(within(recruitment).getByRole("heading", { name: "Recruitment Openings" })).toBeVisible();
    expect(within(recruitment).getByText("Apply online for San Juan City Police Station quota.")).toBeVisible();
    expect(within(recruitment).getByRole("heading", { name: "Patrol Officer" })).toBeVisible();
    expect(within(recruitment).getByText("Deadline: October 31, 2026")).toBeVisible();
    expect(within(recruitment).getByRole("link", { name: "View details for Patrol Officer" })).toHaveAttribute("href", "/jobs/7");
    expect(within(recruitment).queryByRole("link", { name: /view all openings/i })).not.toBeInTheDocument();
    expect(within(recruitment).queryByRole("textbox", { name: "Reference number" })).not.toBeInTheDocument();
    expect(within(recruitment).getByRole("link", { name: /create an applicant account/i })).toHaveAttribute("href", "/applicant/register");
    const form = within(recruitment).getByRole("button", { name: "Track Status" }).closest("form")!;
    expect(form).toHaveAttribute("action", "/login");
    expect(new FormData(form).get("as")).toBe("applicant");
    expect(new FormData(form).get("next")).toBe("/applicant/applications");
  });

  it("shows the station address, emergency hotline, and map in Contact Us", () => {
    render(<PublicCareersLanding />);
    const contact = screen.getByRole("region", { name: "Contact Us" });
    expect(within(contact).getByText("Santolan Road cor. Col. Bonny Serrano Avenue, San Juan City, Metro Manila")).toBeVisible();
    expect(within(contact).getByText("0917-773-7885 / (02) 8724-2515")).toBeVisible();
    expect(within(contact).getByText("Emergency Hotline 911")).toBeVisible();
    expect(within(contact).getByTitle("Map of San Juan City Police Station").getAttribute("src")).toMatch(/^https:\/\/maps\.google\.com\/maps\?q=.+output=embed$/);
    expect(within(contact).getByRole("link", { name: /get directions on google maps/i })).toHaveAttribute("target", "_blank");
  });
});
