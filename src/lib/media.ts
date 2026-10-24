import type { MediaRef } from "@/lib/domain/schema";

export const MEDIA_BUCKET = "quiz-media";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** Public URL for an object in the media bucket (the bucket is public-read). */
export function mediaUrl(media: Pick<MediaRef, "path"> | null | undefined): string | null {
  if (!media) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const encoded = media.path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${encoded}`;
}
