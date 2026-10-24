"use client";

import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/client/api";
import { uploadImage } from "@/lib/client/upload";
import type { MediaRef } from "@/lib/domain/schema";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/** Image picker with preview, replace, remove and upload progress. */
export function ImageField({
  value,
  onChange,
  label = "Slika",
  className,
  aspect = "aspect-video",
  compact,
}: {
  value: MediaRef | null;
  onChange: (value: MediaRef | null) => void;
  label?: string;
  className?: string;
  aspect?: string;
  compact?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const url = mediaUrl(value);

  async function handleFile(file: File) {
    setProgress(0);
    try {
      const media = await uploadImage(file, setProgress);
      onChange(media);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Prijenos slike nije uspio.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const uploading = progress !== null;

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {url && !uploading ? (
        <div className={cn("group relative overflow-hidden rounded-xl bg-night-950 ring-1 ring-white/10", aspect)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={value?.alt ?? ""} className="size-full object-contain" />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button type="button" size="icon-sm" variant="secondary" className="bg-night-950/80" aria-label="Zamijeni sliku" onClick={() => inputRef.current?.click()}>
              <RefreshCw />
            </Button>
            <Button type="button" size="icon-sm" variant="secondary" className="bg-night-950/80 text-coral-400" aria-label="Ukloni sliku" onClick={() => onChange(null)}>
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 text-ink-subtle transition-colors hover:border-cyan-300/60 hover:text-ink",
            aspect,
            dragOver && "border-cyan-300 bg-cyan-400/5",
            compact ? "p-2 text-xs" : "p-4 text-sm",
          )}
        >
          {uploading ? (
            <div className="w-3/4">
              <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Prijenos slike">
                <div className="h-full rounded-full bg-cyan-400 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-2 text-center font-semibold">Prijenos… {Math.round(progress * 100)} %</p>
            </div>
          ) : (
            <>
              <ImagePlus className={compact ? "size-5" : "size-7"} />
              <span className="font-semibold">{compact ? "Slika" : `${label} — klikni ili povuci`}</span>
              {!compact && <span className="text-xs text-ink-faint">PNG, JPG, WebP, GIF · do 5 MB</span>}
            </>
          )}
        </button>
      )}
    </div>
  );
}
