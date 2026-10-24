import type { Metadata } from "next";
import { PracticeStart } from "@/components/player/practice-start";

export const metadata: Metadata = { title: "Vježba" };

export default async function PracticePage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  return <PracticeStart quizId={quizId} />;
}
