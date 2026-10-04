import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

const mocks = vi.hoisted(() => ({ announcements: vi.fn(), contacts: vi.fn() }));

vi.mock("@/hooks/use-recruitment", () => ({
  usePublishedJobs: vi.fn(() => ({
    data: { rows: [{ closes_on: "2026-10-31", description: "Serve the community through visible patrol work.", id: 7, location: "San Juan City", title: "Patrol Officer" }] },
    error: null,
    isLoading: false,
  })),
}));
vi.mock("@/hooks/use-public-site", () => ({
  usePublishedAnnouncements: mocks.announcements,
  useVisibleContacts: mocks.contacts,
}));

import { PublicCareersLanding } from "./public-careers-landing";

const announcementId = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
const loaded = <T,>(data: T) => ({ data, error: null, isLoading: false });

describe("PublicCareersLanding", () => {
  beforeEach(() => {
    mocks.announcements.mockReturnValue(loaded([
      { id: announcementId, title: "Road safety advisory", summary: "Expect road works near the station.", category: "advisory", published_at: "2026-10-03T02:00:00Z" },
    ]));
    mocks.contacts.mockReturnValue(loaded([
      { id: "c1", label: "HR Office", kind: "phone", value: "(02) 8123-4567", sort_order: 1 },
    ]));
  });

  it("lays the sections out in the spec's order under one page heading", () => {
    const { container } = render(<PublicCareersLanding />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /serve san juan/i })).toBeVisible();
    expect([...container.querySelectorAll("main > section[id]")].map((section) => section.id)).toEqual(["portals", "job-openings", "announcements", "about", "why-join", "faqs", "contact"]);
    const sections = screen.getByRole("navigation", { name: "Page sections" });
    expect(within(sections).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#portals", "#announcements", "#about", "#why-join", "#faqs", "#contact"]);
  });

  it("sends personnel and applicants to the real sign-in and job pages", () => {
    render(<PublicCareersLanding />);
    expect(screen.getByRole("heading", { name: "Personnel Portal" })).toBeVisible();
    expect(screen.getByRole("link", { name: /sign in as personnel/i })).toHaveAttribute("href", "/login?as=employee");
    expect(screen.getByRole("heading", { name: "Applicant & Career Portal" })).toBeVisible();
    expect(screen.getByRole("link", { name: /view job openings/i })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: /check application status/i })).toHaveAttribute("href", "/login?as=applicant&next=/applicant/applications");
  });

  it("keeps the latest job openings with a link to all of them", () => {
    render(<PublicCareersLanding />);
    expect(screen.getByRole("link", { name: "View details for Patrol Officer" })).toHaveAttribute("href", "/jobs/7");
    expect(screen.getByRole("link", { name: /view all openings/i })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: /create an applicant account/i })).toHaveAttribute("href", "/applicant/register");
  });

  it("lists published announcements with date, category and a Read more link", () => {
    render(<PublicCareersLanding />);
    const section = screen.getByRole("region", { name: "Announcements" });
    expect(within(section).getByRole("heading", { name: "Road safety advisory" })).toBeVisible();
    expect(within(section).getByText("Advisory")).toBeVisible();
    expect(within(section).getByText("October 3, 2026")).toBeVisible();
    expect(within(section).getByRole("link", { name: "Read more about Road safety advisory" })).toHaveAttribute("href", `/announcements/${announcementId}`);
  });

  it("says so when there are no announcements", () => {
    mocks.announcements.mockReturnValue(loaded([]));
    render(<PublicCareersLanding />);
    expect(within(screen.getByRole("region", { name: "Announcements" })).getByText("No announcements right now.")).toBeVisible();
  });

  it("shows the station's vision, mission and motto, and three benefit cards", () => {
    render(<PublicCareersLanding />);
    expect(screen.getByRole("heading", { name: "Vision" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Mission" })).toBeVisible();
    expect(screen.getByText("Serbisyo, Karangalan, Katarungan")).toBeVisible();
    expect(within(screen.getByRole("region", { name: /why join/i })).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("answers FAQs in native details elements, naming every required document", () => {
    render(<PublicCareersLanding />);
    const faqs = screen.getByRole("region", { name: "Frequently asked questions" });
    expect(faqs.querySelectorAll("details > summary")).toHaveLength(3);
    expect(within(faqs).getByText("Who can apply?")).toBeInTheDocument();
    expect(within(faqs).getByText("Which documents do I need?")).toBeInTheDocument();
    expect(within(faqs).getByText("How do I check my application status?")).toBeInTheDocument();
    for (const { label, formats } of APPLICANT_PROFILE_DOCUMENT_KINDS) {
      expect(within(faqs).getByText(`${label} (${formats})`)).toBeInTheDocument();
    }
    // Native disclosure only: no scripted accordion buttons inside the FAQ section.
    expect(faqs.querySelector("button")).toBeNull();
  });

  it("shows HR's contacts with dialable links", () => {
    render(<PublicCareersLanding />);
    const contact = screen.getByRole("region", { name: "Contact us" });
    expect(within(contact).getByText("HR Office")).toBeVisible();
    expect(within(contact).getByRole("link", { name: "(02) 8123-4567" })).toHaveAttribute("href", "tel:0281234567");
  });

  it("hides the Contact section and its link while there are no visible contacts", () => {
    mocks.contacts.mockReturnValue(loaded([]));
    render(<PublicCareersLanding />);
    expect(screen.queryByRole("region", { name: "Contact us" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).queryByRole("link", { name: "Contact" })).not.toBeInTheDocument();
  });

  it("hides the Contact section when contacts cannot be loaded", () => {
    mocks.contacts.mockReturnValue({ data: undefined, error: new Error("network down"), isLoading: false });
    render(<PublicCareersLanding />);
    expect(screen.queryByRole("region", { name: "Contact us" })).not.toBeInTheDocument();
    expect(screen.queryByText("network down")).not.toBeInTheDocument();
  });

  it("uses the app's own light theme and colours, not the mock's dark navy and gold", () => {
    const { container } = render(<PublicCareersLanding />);
    expect(container.querySelector(".dark")).toBeNull();
    expect(container.innerHTML).not.toMatch(/portal-grid|portal-type|glass-panel|text-cta|bg-cta|border-cta|font-extrabold/);
  });

  it("leaves out the mock's recruitment process, invented figures and small text", () => {
    const { container } = render(<PublicCareersLanding />);
    expect(screen.queryByText(/recruitment process/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ORPAS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/₱/)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/text-\[(?:\d|1[0-3])px\]/);
    expect(screen.getAllByAltText("Bagong Pilipinas logo").length).toBeGreaterThan(0);
    expect(screen.getByText(/Data Privacy Act of 2012/)).toBeInTheDocument();
  });
});
