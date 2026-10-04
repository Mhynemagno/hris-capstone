"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  deleteAnnouncement,
  deletePublicContact,
  listHrAnnouncements,
  listHrContacts,
  listPublishedAnnouncements,
  listVisibleContacts,
  reorderPublicContacts,
  saveAnnouncement,
  savePublicContact,
  setAnnouncementStatus,
} from "@/queries/public-site";
import type { AnnouncementInput, AnnouncementStatusChange, PublicContactInput } from "@/schemas/public-site";

export function usePublishedAnnouncements(limit = 6) {
  return useQuery({ queryKey: queryKeys.publicSite.publishedAnnouncements(limit), queryFn: () => listPublishedAnnouncements(limit) });
}

export function useVisibleContacts() {
  return useQuery({ queryKey: queryKeys.publicSite.visibleContacts(), queryFn: listVisibleContacts });
}

export function useHrAnnouncements() {
  return useQuery({ queryKey: queryKeys.publicSite.hrAnnouncements(), queryFn: listHrAnnouncements });
}

export function useHrContacts() {
  return useQuery({ queryKey: queryKeys.publicSite.hrContacts(), queryFn: listHrContacts });
}

/** Every public-site write can change both the HR lists and what visitors see. */
function useRefreshPublicSite() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["public-site"] });
}

export function useSaveAnnouncement() {
  const refresh = useRefreshPublicSite();
  return useMutation({
    mutationFn: ({ input, announcementId }: { input: AnnouncementInput; announcementId?: string }) => saveAnnouncement(input, announcementId),
    onSuccess: refresh,
  });
}

export function useSetAnnouncementStatus() {
  const refresh = useRefreshPublicSite();
  return useMutation({
    mutationFn: ({ announcementId, status }: { announcementId: string; status: AnnouncementStatusChange }) => setAnnouncementStatus(announcementId, status),
    onSuccess: refresh,
  });
}

export function useDeleteAnnouncement() {
  const refresh = useRefreshPublicSite();
  return useMutation({ mutationFn: (announcementId: string) => deleteAnnouncement(announcementId), onSuccess: refresh });
}

export function useSavePublicContact() {
  const refresh = useRefreshPublicSite();
  return useMutation({
    mutationFn: ({ input, contactId }: { input: PublicContactInput; contactId?: string }) => savePublicContact(input, contactId),
    onSuccess: refresh,
  });
}

export function useDeletePublicContact() {
  const refresh = useRefreshPublicSite();
  return useMutation({ mutationFn: (contactId: string) => deletePublicContact(contactId), onSuccess: refresh });
}

export function useReorderPublicContacts() {
  const refresh = useRefreshPublicSite();
  return useMutation({ mutationFn: (orderedIds: string[]) => reorderPublicContacts(orderedIds), onSuccess: refresh });
}
