"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  useEmployeeProfilePhotoUrl,
  useRemoveMyEmployeeProfilePhoto,
  useReplaceMyEmployeeProfilePhoto,
} from "@/hooks/use-personnel-records";
import { profilePhotoFileSchema } from "@/schemas/personnel-records";

type EmployeeProfilePhotoControlProps = {
  employee: {
    id: string;
    profile_image_path: string | null;
  };
  canManagePhoto?: boolean;
};

export function EmployeeProfilePhotoControl({
  employee,
  canManagePhoto = false,
}: EmployeeProfilePhotoControlProps) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const photo = useEmployeeProfilePhotoUrl(employee.profile_image_path);
  const replace = useReplaceMyEmployeeProfilePhoto(employee);
  const remove = useRemoveMyEmployeeProfilePhoto(employee);
  const hasPhoto = Boolean(employee.profile_image_path);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = replace.isPending || remove.isPending;

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    const validated = profilePhotoFileSchema.safeParse(file);
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
      <Image alt={photo.data ? "Employee profile photo" : "Default profile avatar"} className="size-full rounded-full object-cover" height={80} src={photo.data ?? "/default-profile-avatar.png"} unoptimized width={80} />
    </Avatar>
    {canManagePhoto ? <div className="mt-3 space-y-2">
      {/* The native file input is visually hidden (so no file name is shown); the button opens it. */}
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
    </div> : null}
    {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
    {notice ? <p className="mt-2 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </div>;
}
