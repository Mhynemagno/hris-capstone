import { z } from "zod";

/**
 * Plain-language validation messages for every schema. A message written on a schema
 * (for example `.min(3, "Badge number must be…")`) still takes precedence; this replaces the
 * library defaults such as "Invalid ISO date" or "Too small: expected string to have >=2 characters".
 */
export function friendlyValidationMessage(issue: z.core.$ZodRawIssue): string | undefined {
  // An empty required text or date field reads better as "required" than as a format error.
  if (issue.input === "" && (issue.code === "too_small" || issue.code === "invalid_format")) return "This field is required.";
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined || issue.input === null || issue.input === "" ? "This field is required." : "Enter a valid value.";
    case "too_small": {
      const minimum = Number(issue.minimum);
      if (issue.origin === "string") return minimum <= 1 ? "This field is required." : `Enter at least ${minimum} characters.`;
      if (issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint") return `Enter a number of at least ${minimum}.`;
      if (issue.origin === "array" || issue.origin === "set") return minimum <= 1 ? "Add at least one item." : `Add at least ${minimum} items.`;
      if (issue.origin === "date") return "Choose a later date.";
      return undefined;
    }
    case "too_big": {
      const maximum = Number(issue.maximum);
      if (issue.origin === "string") return `Use ${maximum} characters or fewer.`;
      if (issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint") return `Enter a number of at most ${maximum}.`;
      if (issue.origin === "array" || issue.origin === "set") return `Add at most ${maximum} items.`;
      if (issue.origin === "file") return "The file is too large.";
      if (issue.origin === "date") return "Choose an earlier date.";
      return undefined;
    }
    case "invalid_format":
      switch (issue.format) {
        case "date":
          return "Enter a valid date.";
        case "datetime":
          return "Enter a valid date and time.";
        case "time":
          return "Enter a valid time.";
        case "email":
          return "Enter a valid email address.";
        case "url":
          return "Enter a valid web address.";
        case "uuid":
        case "guid":
          return "Select a valid option.";
        default:
          return "Use the expected format.";
      }
    case "invalid_value":
      return "Choose one of the listed options.";
    case "not_multiple_of":
      return "Enter a whole number.";
    default:
      return undefined;
  }
}

z.config({ customError: friendlyValidationMessage });
