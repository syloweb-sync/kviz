import type { Metadata } from "next";
import { QuizPreview } from "@/components/editor/quiz-preview";
import { loadOwnedQuizForPage } from "@/lib/server/pages";

export const metadata: Metadata = { title: "Pregled kviza" };

export default async function PreviewQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { quiz } = await loadOwnedQuizForPage(id, `/quizzes/${id}/preview`);
  return <QuizPreview quizId={quiz.id} document={quiz.document} />;
}
