import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./use-mobile";

function MobileProbe() {
  return <p>{useIsMobile() ? "mobile" : "desktop"}</p>;
}

describe("useIsMobile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the current mobile media-query result", async () => {
    const matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("matchMedia", matchMedia);

    render(<MobileProbe />);

    expect(await screen.findByText("mobile")).toBeInTheDocument();
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });
});
