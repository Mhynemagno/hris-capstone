import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { AnnouncementBody } from "./announcement-body";

it("renders paragraphs and line breaks from plain text", () => {
  const { container } = render(<AnnouncementBody body={"First line\nsecond line\n\nNext paragraph"} />);
  expect(container.querySelectorAll("p")).toHaveLength(2);
  expect(container.querySelectorAll("br")).toHaveLength(1);
  expect(screen.getByText("Next paragraph")).toBeInTheDocument();
});

it("shows HTML typed by HR as literal text, never as markup", () => {
  const { container } = render(<AnnouncementBody body={"<script>alert('x')</script>\n\n<b>Bold</b>"} />);
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("b")).toBeNull();
  expect(screen.getByText("<b>Bold</b>")).toBeInTheDocument();
});
