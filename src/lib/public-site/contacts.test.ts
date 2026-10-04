import { describe, expect, it } from "vitest";

import { contactHref, moveId } from "./contacts";

describe("contactHref", () => {
  it("dials phone numbers and mails email addresses", () => {
    expect(contactHref("phone", "(02) 8123-4567")).toBe("tel:0281234567");
    expect(contactHref("phone", "+63 917 123 4567")).toBe("tel:+639171234567");
    expect(contactHref("email", " hr@example.test ")).toBe("mailto:hr@example.test");
  });

  it("links only full Facebook page URLs and leaves addresses and hours as text", () => {
    expect(contactHref("facebook", "https://www.facebook.com/SanJuanPolice")).toBe("https://www.facebook.com/SanJuanPolice");
    expect(contactHref("facebook", "javascript:alert(1)")).toBeNull();
    expect(contactHref("address", "San Juan City")).toBeNull();
    expect(contactHref("hours", "8:00 AM to 5:00 PM")).toBeNull();
  });
});

describe("moveId", () => {
  it("swaps an entry with its neighbour and ignores moves past either end", () => {
    expect(moveId(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});
