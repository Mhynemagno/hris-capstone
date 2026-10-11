import { describe, expect, it } from "vitest";
import { applyMarkup, parseAnnouncementMarkup, parseInline, stripAnnouncementMarkup } from "./announcement-markup";

const text = (value: string) => ({ type: "text", text: value });

describe("parseInline", () => {
  it("reads bold, italic, underline and links", () => {
    expect(parseInline("Hello **world**")).toEqual([text("Hello "), { type: "strong", children: [text("world")] }]);
    expect(parseInline("*one* and ++two++")).toEqual([{ type: "em", children: [text("one")] }, text(" and "), { type: "u", children: [text("two")] }]);
    expect(parseInline("See [PNP](https://pnp.gov.ph) now")).toEqual([text("See "), { type: "link", href: "https://pnp.gov.ph", children: [text("PNP")] }, text(" now")]);
    expect(parseInline("**bold *and italic***")[0]).toMatchObject({ type: "strong" });
  });
  it("keeps anything unsafe or unbalanced as literal text", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([text("[x](javascript:alert(1))")]);
    expect(parseInline("<script>alert(1)</script>")).toEqual([text("<script>alert(1)</script>")]);
    expect(parseInline("**")).toEqual([text("**")]);
    expect(parseInline("2 * 3 * 4")).toEqual([text("2 * 3 * 4")]);
    expect(parseInline("**open only")).toEqual([text("**open only")]);
  });
});

describe("parseAnnouncementMarkup", () => {
  it("keeps old plain posts as paragraphs with line breaks", () => {
    expect(parseAnnouncementMarkup("Line one\nLine two\n\nSecond paragraph")).toEqual([
      { type: "paragraph", lines: [[text("Line one")], [text("Line two")]] },
      { type: "paragraph", lines: [[text("Second paragraph")]] },
    ]);
  });
  it("turns dash lines into a bullet list", () => {
    expect(parseAnnouncementMarkup("Bring:\n- ID\n- **Pen**\n\nThanks")).toEqual([
      { type: "paragraph", lines: [[text("Bring:")]] },
      { type: "list", items: [[text("ID")], [{ type: "strong", children: [text("Pen")] }]] },
      { type: "paragraph", lines: [[text("Thanks")]] },
    ]);
  });
});

describe("stripAnnouncementMarkup", () => {
  it("leaves the words for card excerpts", () => {
    expect(stripAnnouncementMarkup("**Bold** [link](https://a.ph) ++u++ *i*\n- item")).toBe("Bold link u i\nitem");
  });
});

describe("applyMarkup", () => {
  it("wraps the selection", () => {
    expect(applyMarkup("say hello", 4, 9, "bold")).toEqual({ value: "say **hello**", selectionStart: 6, selectionEnd: 11 });
    expect(applyMarkup("say hello", 4, 9, "underline").value).toBe("say ++hello++");
  });
  it("inserts empty markers at the cursor", () => {
    expect(applyMarkup("ab", 1, 1, "italic")).toEqual({ value: "a**b", selectionStart: 2, selectionEnd: 2 });
  });
  it("bullets every selected line", () => {
    expect(applyMarkup("one\ntwo", 0, 7, "list").value).toBe("- one\n- two");
  });
  it("links the selection to a URL", () => {
    expect(applyMarkup("visit site", 6, 10, "link", "https://pnp.gov.ph").value).toBe("visit [site](https://pnp.gov.ph)");
  });
});
