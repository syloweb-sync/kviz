import type { Metadata } from "next";
import { QuizEditor } from "@/components/editor/quiz-editor";
import { loadOwnedQuizForPage } from "@/lib/server/pages";

export const metadata: Metadata = { title: "Uređivanje kviza" };

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { quiz } = await loadOwnedQuizForPage(id, `/quizzes/${id}/edit`);
  return (
    <>
      {quiz.skipped > 0 && (
        <p role="alert" className="bg-coral-500/20 px-4 py-2 text-center text-sm font-semibold text-coral-400">
          {quiz.skipped} oštećenih pitanja nije bilo moguće učitati i bit će uklonjena pri sljedećem spremanju.
        </p>
      )}
      <QuizEditor quizId={quiz.id} initial={quiz.document} initialPracticeShared={quiz.practiceShared} />
    </>
  );
}
