"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AnswerError, resolveAnswer } from "@/lib/domain/answers";
import { pointsMultiplier } from "@/lib/domain/question-defaults";
import { toPublicQuestion, toRevealedAnswer } from "@/lib/domain/public-view";
import { computePoints, evaluateAnswer, type Evaluation } from "@/lib/domain/scoring";
import type { Question } from "@/lib/domain/schema";
import { validateQuestionForPlay } from "@/lib/domain/validation";
import { AnswerInput } from "./answer-input";
import { QuestionStage } from "./question-stage";
import { ResultBanner, RevealView } from "./reveal";

const PREVIEW_SEED = "editor-preview";

/**
 * Lets the quiz author try a question exactly as players see it. Grading runs locally with
 * the same scoring engine the server uses (the author owns the answers anyway).
 */
export function QuestionPreview({ question }: { question: Question }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ evaluation: Evaluation; points: number; answer: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const publicQuestion = useMemo(
    () => toPublicQuestion(question, { seed: `${PREVIEW_SEED}:${attempt}`, randomizeAnswers: false, timeLimit: question.timeLimit }),
    [question, attempt],
  );
  const issues = validateQuestionForPlay(question);

  if (issues.length) {
    return (
      <div className="rounded-xl bg-sun-400/10 p-5 text-sun-300">
        <p className="font-bold">Pregled je dostupan kad pitanje bude dovršeno:</p>
        <ul className="mt-2 list-inside list-disc text-sm">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <QuestionStage question={publicQuestion} />
      {result ? (
        <div className="space-y-5">
          <ResultBanner status={result.evaluation.status} points={result.points} />
          <RevealView question={publicQuestion} answer={toRevealedAnswer(question, `${PREVIEW_SEED}:${attempt}`)} stats={null} own={result.answer} />
          {question.explanation && <p className="rounded-xl bg-night-800 p-4 text-ink-muted">{question.explanation}</p>}
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setAttempt((a) => a + 1);
            }}
          >
            <RotateCcw /> Pokušaj ponovno
          </Button>
        </div>
      ) : (
        <>
          <AnswerInput
            key={attempt}
            question={publicQuestion}
            disabled={false}
            submitted={null}
            onSubmit={(answer) => {
              try {
                const internal = resolveAnswer(question, answer, `${PREVIEW_SEED}:${attempt}`);
                const evaluation = evaluateAnswer(question, internal);
                const points =
                  evaluation.status === "pending_review"
                    ? 0
                    : computePoints({
                        fraction: evaluation.fraction,
                        multiplier: pointsMultiplier(question),
                        basePoints: 1000,
                        speedBonus: false,
                        responseMs: 0,
                        timeLimitMs: question.timeLimit * 1000,
                      }).total;
                setError(null);
                setResult({ evaluation, points, answer });
              } catch (err) {
                setError(err instanceof AnswerError ? err.message : "Odgovor nije valjan.");
              }
            }}
          />
          {error && (
            <p role="alert" className="font-semibold text-coral-400">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
