import { describe, expect, it } from "vitest";

import { applyRememberMe } from "./remember-me";

describe("applyRememberMe", () => {
  const persistent = { path: "/", sameSite: "lax" as const, maxAge: 34560000 };

  it("keeps persistent cookies when the user chose to be remembered", () => {
    expect(applyRememberMe(persistent, false)).toEqual(persistent);
  });

  it("turns auth cookies into session cookies when the user did not tick Remember me", () => {
    expect(applyRememberMe(persistent, true)).toEqual({ path: "/", sameSite: "lax" });
    expect(applyRememberMe({ ...persistent, expires: new Date() }, true)).toEqual({ path: "/", sameSite: "lax" });
  });

  it("never touches a removal (maxAge 0), so sign-out and chunk clean-up still delete cookies", () => {
    expect(applyRememberMe({ path: "/", maxAge: 0 }, true)).toEqual({ path: "/", maxAge: 0 });
  });

  it("passes undefined through", () => {
    expect(applyRememberMe(undefined, true)).toBeUndefined();
  });
});
