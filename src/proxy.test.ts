import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAuthenticationProtectedPath, proxy } from "./proxy";

const { updateSession } = vi.hoisted(() => ({
  updateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

describe("authentication proxy", () => {
  beforeEach(() => {
    updateSession.mockReset();
  });

  it("keeps the applicant registration route public", () => {
    expect(isAuthenticationProtectedPath("/applicant/register")).toBe(false);
  });

  it("protects future application routes", () => {
    expect(isAuthenticationProtectedPath("/hr")).toBe(true);
    expect(isAuthenticationProtectedPath("/applicant/profile")).toBe(true);
  });

  it("redirects an anonymous visitor to login with the requested path", async () => {
    updateSession.mockResolvedValue({
      response: NextResponse.next(),
      userId: null,
    });

    const response = await proxy(
      new NextRequest("http://localhost/hr?tab=people"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fhr%3Ftab%3Dpeople",
    );
  });

  it("allows a verified visitor through a protected route", async () => {
    updateSession.mockResolvedValue({
      response: NextResponse.next(),
      userId: "00000000-0000-4000-8000-000000000001",
    });

    const response = await proxy(new NextRequest("http://localhost/hr"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
