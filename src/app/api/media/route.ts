import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { handler, json, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { MAX_UPLOAD_BYTES, MEDIA_BUCKET } from "@/lib/media";
import { getAdminSupabase } from "@/lib/supabase/server";

const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as const;

const uploadSchema = z.object({
  mimeType: z.enum(Object.keys(EXTENSIONS) as [keyof typeof EXTENSIONS, ...(keyof typeof EXTENSIONS)[]]),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/**
 * Issues a one-time signed upload URL for `<user-id>/<uuid>.<ext>` in the `quiz-media` bucket.
 * The bucket itself enforces the size limit and MIME allow-list on upload.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  await enforceRateLimit("media-upload", user.id, 120, 3600);
  const { mimeType, size } = uploadSchema.parse(await readJson(request));
  const path = `${user.id}/${randomUUID()}.${EXTENSIONS[mimeType]}`;
  const admin = getAdminSupabase();

  const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  const { error: recordError } = await admin
    .from("quiz_media")
    .insert({ owner_id: user.id, path, mime_type: mimeType, size_bytes: size });
  if (recordError) throw recordError;

  return json({ path, signedUrl: data.signedUrl, token: data.token }, { status: 201 });
});
