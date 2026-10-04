import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedAnnouncement: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/public-site/published-announcement", () => ({ getPublishedAnnouncement: mocks.getPublishedAnnouncement }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/recruitment/public-site-header", () => ({ PublicSiteHeader: () => <header data-testid="public-header" /> }));

import AnnouncementPage, { generateMetadata } from "./page";

const id = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
const announcement = {
  id,
  title: "Road safety advisory",
  summary: "Expect road works near the station.",
  body: "First paragraph.\n\nSecond paragraph.",
  category: "advisory",
  published_at: "2026-10-03T02:00:00Z",
};
const props = (value: string) => ({ params: Promise.resolve({ id: value }) });

describe("AnnouncementPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a published announcement under the public header", async () => {
    mocks.getPublishedAnnouncement.mockResolvedValue(announcement);
    render(await AnnouncementPage(props(id)));
    expect(screen.getByTestId("public-header")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Road safety advisory" })).toBeVisible();
    expect(screen.getByText("Advisory")).toBeVisible();
    expect(screen.getByText("October 3, 2026")).toBeVisible();
    expect(screen.getByText("Second paragraph.")).toBeVisible();
    expect(mocks.getPublishedAnnouncement).toHaveBeenCalledWith(id);
  });

  it("returns notFound for a missing, draft or archived announcement", async () => {
    mocks.getPublishedAnnouncement.mockResolvedValue(null);
    await expect(AnnouncementPage(props(id))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("uses the title and summary as page metadata", async () => {
    mocks.getPublishedAnnouncement.mockResolvedValue(announcement);
    await expect(generateMetadata(props(id))).resolves.toEqual({ title: "Road safety advisory | San Juan City Police HRIS", description: "Expect road works near the station." });
  });

  it("gives a missing announcement a not-found title", async () => {
    mocks.getPublishedAnnouncement.mockResolvedValue(null);
    await expect(generateMetadata(props("nope"))).resolves.toEqual({ title: "Announcement not found | San Juan City Police HRIS" });
  });
});
