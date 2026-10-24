import type { MediaRef } from "@/lib/domain/schema";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, type AcceptedImageType } from "@/lib/media";
import { ApiClientError, apiFetch } from "./api";

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as AcceptedImageType)) return "Podržani su PNG, JPG, WebP i GIF.";
  if (file.size > MAX_UPLOAD_BYTES) return "Slika smije imati najviše 5 MB.";
  return null;
}

async function imageSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("empty");
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new ApiClientError(400, "invalid_image", "Slika se ne može otvoriti.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Uploads an image: asks the server for a one-time signed URL, then PUTs the file directly
 * to Supabase Storage with XHR so we can report progress.
 */
export async function uploadImage(file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<MediaRef> {
  const problem = validateImageFile(file);
  if (problem) throw new ApiClientError(400, "invalid_file", problem);
  const { width, height } = await imageSize(file);
  const { path, signedUrl } = await apiFetch<{ path: string; signedUrl: string }>("/api/media", {
    method: "POST",
    body: { mimeType: file.type, size: file.size },
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (key) xhr.setRequestHeader("apikey", key);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiClientError(xhr.status, "upload_failed", "Prijenos slike nije uspio."));
    xhr.onerror = () => reject(new ApiClientError(0, "network", "Prijenos je prekinut. Provjerite vezu."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
  onProgress(1);
  return { path, width, height };
}
