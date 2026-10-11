import { describe, expect, it } from "vitest";

import { formatBytes } from "./format-bytes";

describe("formatBytes", () => {
  it("writes kilobytes and megabytes", () => {
    expect(formatBytes(4)).toBe("1 KB");
    expect(formatBytes(61_440)).toBe("60 KB");
    expect(formatBytes(1_258_291)).toBe("1.2 MB");
  });
});
