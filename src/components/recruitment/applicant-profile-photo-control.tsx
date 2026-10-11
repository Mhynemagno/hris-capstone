"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { notifyApplicant } from "@/components/app-shell/applicant-toaster";
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
  /** "ring": the Capstone UI profile header's 2x2 photo box with a camera button; notices appear as toasts. */
  variant?: "default" | "ring";
  /** Shown in the ring when there is no photo yet. */
  initials?: string;
};

export function ApplicantProfilePhotoControl({ applicant, initials = "", variant = "default" }: ApplicantProfilePhotoControlProps) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const photo = useApplicantProfilePhotoUrl(applicant.profile_image_path);
  const replace = useReplaceMyApplicantProfilePhoto(applicant);
  const remove = useRemoveMyApplicantProfilePhoto(applicant);
  const hasPhoto = Boolean(applicant.profile_image_path);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = replace.isPending || remove.isPending;

  // In the profile header the outcome appears as the portal's top-right notice.
  useEffect(() => {
    if (variant === "ring" && error) notifyApplicant({ title: "Photo not saved", description: error, tone: "error" });
  }, [error, variant]);
  useEffect(() => {
    if (variant === "ring" && notice) notifyApplicant({ title: "2x2 Photo Updated", description: notice });
  }, [notice, variant]);

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

  if (variant === "ring") {
    return <div className="group relative shrink-0">
      <div className="relative flex size-28 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-blue-400/60 bg-slate-800 shadow-2xl">
        {photo.data
          ? <Image alt="Applicant 2x2 ID picture" className="size-full object-cover" height={112} src={photo.data} unoptimized width={112} />
          : <span className="text-3xl font-extrabold tracking-wider text-white">{initials}</span>}
        <span className="absolute inset-x-0 bottom-0 bg-blue-900/90 py-0.5 text-center text-[9px] font-bold tracking-tight text-blue-200 uppercase">2x2 Photo</span>
      </div>
      <label
        className="absolute -right-2 -bottom-2 flex size-10 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-900 bg-blue-600 text-white shadow-lg transition-all group-hover:scale-105 hover:bg-blue-500 focus-within:ring-2 focus-within:ring-blue-300"
        htmlFor={inputId}
        title="Upload Required 2x2 ID Picture (JPG or PNG)"
      >
        <Camera aria-hidden="true" className="size-3.5" />
        <input
          accept="image/jpeg,image/png"
          aria-label="Upload 2x2 ID picture"
          className="sr-only"
          disabled={busy}
          id={inputId}
          onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.target.value = ""; }}
          type="file"
        />
      </label>
      {error ? <p className="sr-only" role="alert">{error}</p> : null}
      {notice ? <p className="sr-only" role="status">{notice}</p> : null}
    </div>;
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
      {/* Remove sits under Change photo, as the client asked. */}
      <div className="flex flex-col items-start gap-2">
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
