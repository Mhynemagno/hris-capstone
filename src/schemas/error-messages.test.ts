import { describe, expect, it } from "vitest";
import { z } from "zod";

import "./error-messages";
import { departmentSchema } from "./administration";
import { employeeNumberSchema, isoDateSchema } from "./common";
import { qualificationSchema } from "./personnel-records";

function firstMessage(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message;
}

describe("plain-language validation messages", () => {
  it("replaces library wording for dates, lengths, and missing values", () => {
    expect(firstMessage(isoDateSchema, "2026-13-40")).toBe("Enter a valid date.");
    expect(firstMessage(isoDateSchema, "")).toBe("This field is required.");
    expect(firstMessage(z.string().trim().min(2), "a")).toBe("Enter at least 2 characters.");
    expect(firstMessage(z.string().max(5), "too long")).toBe("Use 5 characters or fewer.");
    expect(firstMessage(z.string(), undefined)).toBe("This field is required.");
    expect(firstMessage(z.number().int().min(0), -1)).toBe("Enter a number of at least 0.");
    expect(firstMessage(z.enum(["a", "b"]), "c")).toBe("Choose one of the listed options.");
    expect(firstMessage(z.email(), "not-an-email")).toBe("Enter a valid email address.");
  });

  it("keeps messages written on a schema", () => {
    expect(firstMessage(employeeNumberSchema, "P1")).toBe("Badge number must be at least 3 characters.");
  });

  it("applies to the record forms that showed library wording", () => {
    expect(firstMessage(departmentSchema, { name: "" })).toBe("This field is required.");
    const qualification = qualificationSchema.safeParse({ employeeId: "3f1e2d3c-4b5a-4968-8776-655443322110", name: "BS", institution: "X", awardedOn: "" });
    expect(qualification.success).toBe(false);
    const messages = qualification.success ? [] : qualification.error.issues.map((issue) => issue.message);
    expect(messages).toContain("This field is required.");
    expect(messages.join(" ")).not.toMatch(/Invalid ISO date|Too small|expected string/);
  });
});
