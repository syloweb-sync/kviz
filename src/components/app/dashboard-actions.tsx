"use client";

import { FileJson, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiClientError, apiFetch } from "@/lib/client/api";

export function DashboardActions() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  async function createQuiz() {
    setCreating(true);
    try {
      const { id } = await apiFetch<{ id: string }>("/api/quizzes", { method: "POST", body: {} });
      router.push(`/quizzes/${id}/edit`);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Kviz nije stvoren.");
      setCreating(false);
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    try {
      if (file.size > 900_000) throw new ApiClientError(400, "too_large", "Datoteka je prevelika (najviše 900 KB).");
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new ApiClientError(400, "invalid_json", "Datoteka nije ispravan JSON.");
      }
      const { id } = await apiFetch<{ id: string }>("/api/quizzes", { method: "POST", body: { import: parsed } });
      toast.success("Kviz je uvezen.");
      router.push(`/quizzes/${id}/edit`);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Uvoz nije uspio.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Odaberi JSON datoteku kviza"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
        }}
      />
      <Button variant="secondary" size="lg" loading={importing} onClick={() => fileRef.current?.click()}>
        <FileJson /> Uvezi JSON
      </Button>
      <Button size="lg" loading={creating} onClick={createQuiz}>
        <Plus /> Novi kviz
      </Button>
    </div>
  );
}
