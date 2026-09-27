export const JOB_POSTING_IMAGE_BUCKET = "job-posting-images";

/** Job posting images live in a public bucket, so their URL is derived without a signed request. */
export function jobPostingImageUrl(objectPath: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!objectPath || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${JOB_POSTING_IMAGE_BUCKET}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}
