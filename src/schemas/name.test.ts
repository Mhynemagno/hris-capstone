import { describe, expect, it } from "vitest";

import { namePartsSchema, withFullName } from "./name";

describe("name schema helpers", () => {
  it("trims names before composing fullName", () => {
    const names = namePartsSchema.parse({ firstName: " Ada ", lastName: " Lovelace " });

    expect(withFullName(names)).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      fullName: "Ada Lovelace",
    });
  });

  it("rejects a blank first or last name", () => {
    expect(namePartsSchema.safeParse({ firstName: "", lastName: "Lovelace" }).success).toBe(false);
    expect(namePartsSchema.safeParse({ firstName: "Ada", lastName: " " }).success).toBe(false);
  });
});
