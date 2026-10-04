import { describe, expect, it } from "vitest";

import { announcementCategoryLabel, announcementSchema, contactKindLabel, publicContactSchema } from "./public-site";

const validAnnouncement = { title: "  Road safety advisory  ", category: "advisory", summary: "Road works this weekend.", body: "First.\n\nSecond." };

describe("announcementSchema", () => {
  it("trims and accepts a valid announcement", () => {
    expect(announcementSchema.parse(validAnnouncement)).toEqual({ ...validAnnouncement, title: "Road safety advisory" });
  });

  it("enforces the spec's length limits", () => {
    expect(announcementSchema.safeParse({ ...validAnnouncement, title: "x".repeat(151) }).error?.issues[0]?.message).toBe("Use 150 characters or fewer.");
    expect(announcementSchema.safeParse({ ...validAnnouncement, summary: "x".repeat(301) }).error?.issues[0]?.message).toBe("Use 300 characters or fewer.");
    expect(announcementSchema.safeParse({ ...validAnnouncement, body: "x".repeat(10_001) }).error?.issues[0]?.message).toBe("Use 10,000 characters or fewer.");
    expect(announcementSchema.safeParse({ ...validAnnouncement, title: "   " }).error?.issues[0]?.message).toBe("Enter a title.");
  });

  it("accepts only the four categories", () => {
    expect(announcementSchema.safeParse({ ...validAnnouncement, category: "gossip" }).success).toBe(false);
    expect(announcementCategoryLabel("event")).toBe("Event");
  });
});

describe("publicContactSchema", () => {
  const contact = (kind: string, value: string) => publicContactSchema.safeParse({ kind, label: "HR Office", value, isVisible: true });

  it("accepts phone numbers and rejects words", () => {
    expect(contact("phone", "(02) 8123-4567").success).toBe(true);
    expect(contact("phone", "+63 917 123 4567").success).toBe(true);
    expect(contact("phone", "call us").error?.issues[0]?.message).toBe("Enter a phone number using digits, spaces, +, (, ) and - only.");
  });

  it("requires a real email address and a full Facebook page link", () => {
    expect(contact("email", "not-an-email").error?.issues[0]?.message).toBe("Enter a valid email address.");
    expect(contact("email", "hr@example.test").success).toBe(true);
    expect(contact("facebook", "facebook.com/station").error?.issues[0]?.message).toBe("Enter the Facebook page link, for example https://www.facebook.com/yourpage.");
    expect(contact("facebook", "https://www.facebook.com/SanJuanPolice").success).toBe(true);
  });

  it("allows free text for an address and office hours", () => {
    expect(contact("address", "Pinaglabanan St.,\nSan Juan City").success).toBe(true);
    expect(contact("hours", "Monday to Friday, 8:00 AM to 5:00 PM").success).toBe(true);
    expect(contactKindLabel("hours")).toBe("Office hours");
  });
});
