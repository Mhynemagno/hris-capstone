"use client";

import Image from "next/image";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useApplicantProfilePhotoUrl,
  useRemoveMyApplicantProfilePhoto,
  useReplaceMyApplicantProfilePhoto,
} from "@/hooks/use-recruitment";
import { applicantProfilePhotoFileSchema } from "@/schemas/recruitment";

type ApplicantProfilePhotoControlProps = {
  applicant: { id: string; profile_image_path: string | null };
};

export function ApplicantProfilePhotoControl({ applicant }: ApplicantProfilePhotoControlProps) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const photo = useApplicantProfilePhotoUrl(applicant.profile_image_path);
  const replace = useReplaceMyApplicantProfilePhoto(applicant);
  const remove = useRemoveMyApplicantProfilePhoto(applicant);
  const hasPhoto = Boolean(applicant.profile_image_path);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    const validated = applicantProfilePhotoFileSchema.safeParse(file);
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Choose a valid profile photo.");
      return;
    }
    try {
      const result = await replace.mutateAsync(validated.data);
      setNotice(result.cleanupError ? "Your new photo was saved, but the old photo could not be removed." : "Profile photo updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the profile photo.");
    }
  }

  async function removePhoto() {
    setError(null);
    setNotice(null);
    try {
      const result = await remove.mutateAsync();
      setNotice(result.cleanupError ? "Your profile photo was removed, but its stored file could not be deleted." : "Profile photo removed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove the profile photo.");
    }
  }

  return <div className="shrink-0">
    <Avatar className="size-20 border text-xl">
      <Image alt={photo.data ? "Applicant profile photo" : "Default profile avatar"} className="size-full rounded-full object-cover" height={80} src={photo.data ?? "/default-profile-avatar.png"} unoptimized width={80} />
    </Avatar>
    <div className="mt-3 space-y-2">
      <Input
        accept="image/png,image/jpeg,image/webp"
        aria-label={hasPhoto ? "Replace profile photo" : "Upload profile photo"}
        disabled={replace.isPending || remove.isPending}
        onChange={(event) => void uploadPhoto(event.target.files?.[0])}
        type="file"
      />
      {hasPhoto ? <Button disabled={replace.isPending || remove.isPending} onClick={() => void removePhoto()} size="sm" type="button" variant="outline">
        {remove.isPending ? "Removing…" : "Remove profile photo"}
      </Button> : null}
      <p className="text-xs text-muted-foreground">Optional. PNG, JPEG, or WebP up to 5 MB.</p>
    </div>
    {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
    {notice ? <p className="mt-2 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </div>;
}
