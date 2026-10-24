import { QUIZ_SCHEMA_VERSION, type QuizDocument, type QuizExport } from "@/lib/domain/schema";
import { apiFetch } from "./api";

export function buildExport(document: QuizDocument): QuizExport {
  return { format: "pitalica-quiz", version: QUIZ_SCHEMA_VERSION, exportedAt: new Date().toISOString(), quiz: document };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .replace(/đ/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "kviz"
  );
}

export async function downloadQuizExport(quizId: string) {
  const { document } = await apiFetch<{ document: QuizDocument }>(`/api/quizzes/${quizId}`);
  downloadJson(buildExport(document), `${slugify(document.title)}.pitalica.json`);
}
