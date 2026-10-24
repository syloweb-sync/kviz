"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { QuestionPreview } from "@/components/game/question-preview";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import type { QuizDocument } from "@/lib/domain/schema";

export function QuizPreview({ quizId, document }: { quizId: string; document: QuizDocument }) {
  const [index, setIndex] = useState(0);
  const question = document.questions[index];
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/quizzes/${quizId}/edit`}>
            <ArrowLeft /> Natrag na uređivanje
          </Link>
        </Button>
        <p className="text-sm font-bold text-ink-subtle">Pregled · odgovori se ne spremaju</p>
      </div>
      <h1 className="mt-6 font-display text-3xl font-extrabold">{document.title || "Kviz bez naslova"}</h1>
      {!question ? (
        <EmptyState
          className="mt-8"
          title="Kviz nema pitanja"
          action={
            <Button asChild>
              <Link href={`/quizzes/${quizId}/edit`}>
                <Pencil /> Dodaj pitanja
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <p className="font-bold text-ink-muted">
              Pitanje {index + 1} / {document.questions.length}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="icon" aria-label="Prethodno pitanje" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Sljedeće pitanje"
                disabled={index === document.questions.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="surface mt-4 rounded-2xl p-5 sm:p-8">
            <QuestionPreview key={question.id} question={question} />
          </div>
        </>
      )}
    </div>
  );
}
