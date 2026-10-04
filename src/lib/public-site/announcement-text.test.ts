import { expect, it } from "vitest";

import { announcementParagraphs } from "./announcement-text";

it("splits on blank lines into paragraphs and keeps single newlines as lines", () => {
  expect(announcementParagraphs("First line\nsecond line\n\n\nNext paragraph")).toEqual([["First line", "second line"], ["Next paragraph"]]);
  expect(announcementParagraphs("Windows\r\n\r\nline endings")).toEqual([["Windows"], ["line endings"]]);
  expect(announcementParagraphs("\n\n  \n")).toEqual([]);
});
