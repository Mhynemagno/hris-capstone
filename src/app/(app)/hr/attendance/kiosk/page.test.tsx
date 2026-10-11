import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));

import KioskPage from "./page";

describe("the Kiosk page is gone (PDF p. 33)", () => {
  it("opens the kiosk from Attendance Logs instead", () => {
    expect(() => KioskPage()).toThrow("REDIRECT /hr/attendance?kiosk=1");
  });
});
