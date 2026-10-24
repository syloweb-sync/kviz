import type { Metadata } from "next";
import { GameSetup } from "@/components/host/game-setup";
import { validateQuizForPlay } from "@/lib/domain/validation";
import { loadOwnedQuizForPage } from "@/lib/server/pages";

export const metadata: Metadata = { title: "Nova igra" };

export default async function HostSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { quiz } = await loadOwnedQuizForPage(id, `/quizzes/${id}/host`);
  return (
    <GameSetup
      quizId={quiz.id}
      title={quiz.document.title}
      questionCount={quiz.document.questions.length}
      issues={validateQuizForPlay(quiz.document)}
    />
  );
}
