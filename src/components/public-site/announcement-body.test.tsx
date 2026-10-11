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

it("formats bold, links and bullets from the HR toolbar's markup", () => {
  const { container } = render(<AnnouncementBody body={"**Hi** [PNP](https://pnp.gov.ph)\n- one"} />);
  expect(container.querySelector("strong")).toHaveTextContent("Hi");
  const link = screen.getByRole("link", { name: "PNP" });
  expect(link).toHaveAttribute("href", "https://pnp.gov.ph");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByRole("listitem")).toHaveTextContent("one");
});

it("never turns an image tag or a javascript: link into markup", () => {
  const { container } = render(<AnnouncementBody body={"<img src=x onerror=alert(1)> [x](javascript:alert(1))"} />);
  expect(container.querySelector("img")).toBeNull();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
});
