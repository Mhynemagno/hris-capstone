import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/types/database";
import { uuidSchema } from "@/schemas/common";

export type PublishedAnnouncement = Pick<Announcement, "id" | "title" | "summary" | "body" | "category" | "published_at">;

/**
 * One published announcement, or null when the id is not a UUID, does not exist, or is a draft or
 * archived. The explicit status filter matters: RLS would also let a signed-in HR user read drafts.
 * React `cache` lets generateMetadata and the page share one query per request (Next.js
 * generate-metadata docs: non-fetch data is not memoized automatically).
 */
export const getPublishedAnnouncement = cache(async (id: string): Promise<PublishedAnnouncement | null> => {
  if (!uuidSchema.safeParse(id).success) return null;
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from("announcements")
    .select("id, title, summary, body, category, published_at")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PublishedAnnouncement | null;
});
