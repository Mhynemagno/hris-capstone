import type { PublicContactKind } from "@/lib/types/database";
import { EMAIL_PATTERN, FACEBOOK_PAGE_PATTERN } from "@/schemas/public-site";

/** The link a visitor can follow for a contact entry, or null when the value is plain text. */
export function contactHref(kind: PublicContactKind, value: string): string | null {
  const trimmed = value.trim();
  if (kind === "phone") {
    const dialable = trimmed.replace(/[^\d+]/g, "");
    return /^\+?\d{7,}$/.test(dialable) ? `tel:${dialable}` : null;
  }
  if (kind === "email") return EMAIL_PATTERN.test(trimmed) ? `mailto:${trimmed}` : null;
  if (kind === "facebook") return FACEBOOK_PAGE_PATTERN.test(trimmed) ? trimmed : null;
  return null;
}

/** The ids in their new order after moving one entry up (-1) or down (+1); unchanged at either end. */
export function moveId(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
