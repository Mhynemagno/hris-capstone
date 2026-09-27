"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = replace.isPending || remove.isPending;

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
      {/* The native file input stays in the page for keyboard and screen-reader users but is visually hidden; the button opens it. */}
      <input
        accept="image/png,image/jpeg,image/webp"
        aria-label={hasPhoto ? "Replace profile photo" : "Upload profile photo"}
        className="sr-only"
        disabled={busy}
        id={inputId}
        onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.target.value = ""; }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      <div className="flex flex-wrap gap-2">
        <Button aria-controls={inputId} disabled={busy} onClick={() => inputRef.current?.click()} size="sm" type="button" variant="outline">
          <Camera aria-hidden="true" /> {replace.isPending ? "Uploading…" : hasPhoto ? "Change photo" : "Upload photo"}
        </Button>
        {hasPhoto ? <Button disabled={busy} onClick={() => void removePhoto()} size="sm" type="button" variant="outline">
          {remove.isPending ? "Removing…" : "Remove profile photo"}
        </Button> : null}
      </div>
      <p className="text-xs text-muted-foreground">Optional. PNG, JPEG, or WebP up to 5 MB.</p>
    </div>
    {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
    {notice ? <p className="mt-2 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </div>;
}
