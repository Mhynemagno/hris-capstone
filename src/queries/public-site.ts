import { z } from "zod";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Announcement, PublicContact, PublishedAnnouncementCard, VisibleContact } from "@/lib/types/database";
import { uuidSchema } from "@/schemas/common";
import {
  announcementSchema,
  announcementStatusChangeSchema,
  publicContactSchema,
  type AnnouncementInput,
  type AnnouncementStatusChange,
  type PublicContactInput,
} from "@/schemas/public-site";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listPublishedAnnouncements(limit = 6) {
  const { data, error } = await createBrowserSupabaseClient()
    .from("announcements")
    .select("id, title, summary, category, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return (data ?? []) as PublishedAnnouncementCard[];
}

export async function listVisibleContacts() {
  const { data, error } = await createBrowserSupabaseClient()
    .from("public_contacts")
    .select("id, label, kind, value, sort_order")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []) as VisibleContact[];
}

export async function listHrAnnouncements() {
  const { data, error } = await createBrowserSupabaseClient().from("announcements").select("*").order("updated_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as Announcement[];
}

export async function listHrContacts() {
  const { data, error } = await createBrowserSupabaseClient()
    .from("public_contacts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []) as PublicContact[];
}

export async function saveAnnouncement(input: AnnouncementInput, announcementId?: string) {
  const values = announcementSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("save_announcement", {
    target_announcement_id: announcementId ? uuidSchema.parse(announcementId) : null,
    target_title: values.title,
    target_summary: values.summary,
    target_body: values.body,
    target_category: values.category,
  });
  throwIfError(error);
  return data as Announcement;
}

export async function setAnnouncementStatus(announcementId: string, status: AnnouncementStatusChange) {
  const id = uuidSchema.parse(announcementId);
  const target = announcementStatusChangeSchema.parse(status);
  const { data, error } = await createBrowserSupabaseClient().rpc("set_announcement_status", { target_announcement_id: id, target_status: target });
  throwIfError(error);
  return data as Announcement;
}

export async function deleteAnnouncement(announcementId: string) {
  const id = uuidSchema.parse(announcementId);
  const { error } = await createBrowserSupabaseClient().rpc("delete_announcement", { target_announcement_id: id });
  throwIfError(error);
}

export async function savePublicContact(input: PublicContactInput, contactId?: string) {
  const values = publicContactSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("save_public_contact", {
    target_contact_id: contactId ? uuidSchema.parse(contactId) : null,
    target_kind: values.kind,
    target_label: values.label,
    target_value: values.value,
    target_is_visible: values.isVisible,
  });
  throwIfError(error);
  return data as PublicContact;
}

export async function deletePublicContact(contactId: string) {
  const id = uuidSchema.parse(contactId);
  const { error } = await createBrowserSupabaseClient().rpc("delete_public_contact", { target_contact_id: id });
  throwIfError(error);
}

export async function reorderPublicContacts(orderedIds: string[]) {
  const ids = z.array(uuidSchema).parse(orderedIds);
  const { error } = await createBrowserSupabaseClient().rpc("reorder_public_contacts", { ordered_contact_ids: ids });
  throwIfError(error);
}
