import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { formatPst, PstClock } from "./pst-clock";

afterEach(() => vi.useRealTimers());

it("shows Philippine Standard Time whatever the visitor's time zone, and ticks every second", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T06:05:09Z"));
  render(<PstClock />);
  expect(screen.getByText("14:05:09")).toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByText("14:05:10")).toBeInTheDocument();
});

it("writes midnight as 00, never 24", () => {
  expect(formatPst(new Date("2026-10-04T16:00:00Z"))).toBe("00:00:00");
});
