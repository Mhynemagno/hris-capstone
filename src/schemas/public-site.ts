import { z } from "zod";

// Importing common installs the plain-language validation messages.
import "./common";

import type { AnnouncementCategory, PublicContactKind } from "@/lib/types/database";

export const ANNOUNCEMENT_CATEGORIES = [
  { value: "news", label: "News" },
  { value: "advisory", label: "Advisory" },
  { value: "event", label: "Event" },
  { value: "recruitment", label: "Recruitment" },
] as const satisfies readonly { value: AnnouncementCategory; label: string }[];

export const ANNOUNCEMENT_STATUS_LABELS = { draft: "Draft", published: "Published", archived: "Archived" } as const;

export const PUBLIC_CONTACT_KINDS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "address", label: "Address" },
  { value: "hours", label: "Office hours" },
  { value: "facebook", label: "Facebook page" },
] as const satisfies readonly { value: PublicContactKind; label: string }[];

export function announcementCategoryLabel(value: AnnouncementCategory) {
  return ANNOUNCEMENT_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

export function contactKindLabel(value: PublicContactKind) {
  return PUBLIC_CONTACT_KINDS.find((kind) => kind.value === value)?.label ?? value;
}

/** Same rules as private.save_public_contact; keep the two in step. */
export const PHONE_PATTERN = /^\+?[0-9()\s.-]{7,30}$/;
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const FACEBOOK_PAGE_PATTERN = /^https:\/\/(www\.|m\.)?facebook\.com\/\S+$/i;

export const announcementCategorySchema = z.enum(["news", "advisory", "event", "recruitment"]);
export const announcementStatusChangeSchema = z.enum(["published", "archived"]);
export type AnnouncementStatusChange = z.infer<typeof announcementStatusChangeSchema>;

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(150, "Use 150 characters or fewer."),
  category: announcementCategorySchema,
  summary: z.string().trim().min(1, "Enter a short summary.").max(300, "Use 300 characters or fewer."),
  body: z.string().trim().min(1, "Enter the announcement text.").max(10_000, "Use 10,000 characters or fewer."),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const publicContactKindSchema = z.enum(["phone", "email", "address", "hours", "facebook"]);

export const publicContactSchema = z
  .object({
    kind: publicContactKindSchema,
    label: z.string().trim().min(1, "Enter a label, for example HR Office.").max(80, "Use 80 characters or fewer."),
    value: z.string().trim().min(1, "Enter the contact details.").max(300, "Use 300 characters or fewer."),
    isVisible: z.boolean(),
  })
  .superRefine((contact, context) => {
    if (!contact.value) return;
    if (contact.kind === "phone" && (!PHONE_PATTERN.test(contact.value) || contact.value.replace(/\D/g, "").length < 7)) {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter a phone number using digits, spaces, +, (, ) and - only." });
    }
    if (contact.kind === "email" && !EMAIL_PATTERN.test(contact.value)) {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid email address." });
    }
    if (contact.kind === "facebook" && !FACEBOOK_PAGE_PATTERN.test(contact.value)) {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter the Facebook page link, for example https://www.facebook.com/yourpage." });
    }
  });
export type PublicContactInput = z.infer<typeof publicContactSchema>;
