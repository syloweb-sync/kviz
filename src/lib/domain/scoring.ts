import type { InternalAnswer } from "./answers";
import { textMatches } from "./normalize";
import type { NormalizedPoint, Question } from "./schema";

/**
 * Centralised, server-authoritative scoring.
 *
 * Every question type has one documented policy that produces a `fraction` in [0, 1]:
 *
 * | type           | policy                                                                     |
 * |----------------|----------------------------------------------------------------------------|
 * | single_choice  | 1 if the chosen option is the correct one, else 0                          |
 * | image_choice   | same as single_choice                                                      |
 * | true_false     | 1 if the value matches, else 0                                             |
 * | multi_select   | 1 only for the exact set. With partial credit:                             |
 * |                | max(0, (correctChosen − wrongChosen) / correctTotal)                       |
 * | slider         | exact mode: 1 only at the target. Otherwise correct within ±tolerance;     |
 * |                | graded mode earns 50–100% linearly (100% at the target, 50% at the edge)   |
 * | numeric        | 1 if |value − target| ≤ tolerance, else 0                                  |
 * | short_answer   | 1 if the normalised text equals an accepted answer. Unmatched answers are  |
 * |                | incorrect, or "pending review" when manual review is enabled               |
 * | pin_image      | correct within the radius (measured in image-width units, aspect-aware);   |
 * |                | graded mode earns 50–100% like the slider                                  |
 * | ordering       | 1 for the exact sequence; partial credit = itemsInCorrectPlace / total     |
 * | matching       | 1 when every pair matches; partial credit = correctPairs / totalPairs      |
 * | poll, ranking  | never graded, never award points                                           |
 *
 * Points are then: base × multiplier × fraction, where — with the speed bonus on — half of
 * that is guaranteed and the other half decays linearly with response time (Kahoot-style).
 */

export type EvaluationStatus = "correct" | "partial" | "incorrect" | "pending_review" | "ungraded";

export interface Evaluation {
  status: EvaluationStatus;
  /** Share of the available points earned, 0–1. */
  fraction: number;
  /** null for ungraded questions and answers awaiting review. */
  isCorrect: boolean | null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function fromFraction(fraction: number): Evaluation {
  const f = clamp01(fraction);
  if (f >= 1) return { status: "correct", fraction: 1, isCorrect: true };
  if (f <= 0) return { status: "incorrect", fraction: 0, isCorrect: false };
  return { status: "partial", fraction: f, isCorrect: false };
}

const binary = (ok: boolean): Evaluation => fromFraction(ok ? 1 : 0);

/** Correct-within-tolerance with optional 50–100% grading by closeness. */
export function toleranceEvaluation(distance: number, tolerance: number, graded: boolean): Evaluation {
  const EPS = 1e-9;
  if (distance <= EPS) return { status: "correct", fraction: 1, isCorrect: true };
  if (tolerance <= 0 || distance > tolerance + EPS) return { status: "incorrect", fraction: 0, isCorrect: false };
  if (!graded) return { status: "correct", fraction: 1, isCorrect: true };
  const fraction = 0.5 + 0.5 * (1 - Math.min(1, distance / tolerance));
  return { status: "correct", fraction, isCorrect: true };
}

/** Distance between two normalised points, expressed as a fraction of the image width. */
export function pinDistance(a: NormalizedPoint, b: NormalizedPoint, aspectRatio: number): number {
  const ratio = aspectRatio > 0 && Number.isFinite(aspectRatio) ? aspectRatio : 1;
  const dx = a.x - b.x;
  const dy = (a.y - b.y) / ratio;
  return Math.sqrt(dx * dx + dy * dy);
}

export function evaluateAnswer(question: Question, answer: InternalAnswer): Evaluation {
  if (answer.type !== question.type) return binary(false);

  switch (question.type) {
    case "single_choice":
    case "image_choice": {
      const a = answer as Extract<InternalAnswer, { optionId: string }>;
      return binary(question.config.correctOptionId !== null && a.optionId === question.config.correctOptionId);
    }
    case "true_false": {
      const a = answer as Extract<InternalAnswer, { type: "true_false" }>;
      return binary(question.config.correct !== null && a.value === question.config.correct);
    }
    case "multi_select": {
      const a = answer as Extract<InternalAnswer, { type: "multi_select" }>;
      const correct = new Set(question.config.correctOptionIds);
      if (correct.size === 0) return binary(false);
      const chosen = new Set(a.optionIds);
      const right = [...chosen].filter((id) => correct.has(id)).length;
      const wrong = chosen.size - right;
      if (right === correct.size && wrong === 0) return binary(true);
      if (!question.config.partialCredit) return binary(false);
      return fromFraction((right - wrong) / correct.size);
    }
    case "slider": {
      const a = answer as Extract<InternalAnswer, { type: "slider" | "numeric" }>;
      const { target, tolerance, exactMatch, graded, step } = question.config;
      if (target === null) return binary(false);
      const distance = Math.abs(a.value - target);
      // Half a step absorbs floating point noise from step snapping.
      if (exactMatch) return binary(distance < step / 2);
      return toleranceEvaluation(distance, tolerance, graded);
    }
    case "numeric": {
      const a = answer as Extract<InternalAnswer, { type: "slider" | "numeric" }>;
      const { target, tolerance } = question.config;
      if (target === null) return binary(false);
      return binary(Math.abs(a.value - target) <= tolerance + 1e-9);
    }
    case "short_answer": {
      const a = answer as Extract<InternalAnswer, { type: "short_answer" }>;
      const accepted = question.config.acceptedAnswers.filter((x) => x.trim().length > 0);
      if (textMatches(a.text, accepted, question.config)) return binary(true);
      if (question.config.manualReview) return { status: "pending_review", fraction: 0, isCorrect: null };
      return binary(false);
    }
    case "pin_image": {
      const a = answer as Extract<InternalAnswer, { type: "pin_image" }>;
      const { target, radius, graded, image } = question.config;
      if (!target) return binary(false);
      const aspect = image ? image.width / image.height : 1;
      return toleranceEvaluation(pinDistance(a, target, aspect), radius, graded);
    }
    case "ordering": {
      const a = answer as Extract<InternalAnswer, { type: "ordering" | "ranking" }>;
      const correct = question.config.items.map((i) => i.id);
      if (correct.length === 0) return binary(false);
      const inPlace = correct.filter((id, index) => a.order[index] === id).length;
      if (inPlace === correct.length) return binary(true);
      return question.config.partialCredit ? fromFraction(inPlace / correct.length) : binary(false);
    }
    case "matching": {
      const a = answer as Extract<InternalAnswer, { type: "matching" }>;
      const pairs = question.config.pairs;
      if (pairs.length === 0) return binary(false);
      const correctPairs = pairs.filter((p) => a.matches[p.id] === p.id).length;
      if (correctPairs === pairs.length) return binary(true);
      return question.config.partialCredit ? fromFraction(correctPairs / pairs.length) : binary(false);
    }
    case "poll":
    case "ranking":
      return { status: "ungraded", fraction: 0, isCorrect: null };
  }
}

export interface PointsInput {
  fraction: number;
  /** 0 (no points), 1 (standard) or 2 (double). */
  multiplier: number;
  basePoints: number;
  speedBonus: boolean;
  responseMs: number;
  timeLimitMs: number;
}

export interface PointsBreakdown {
  correctness: number;
  speed: number;
  total: number;
}

export function computePoints(input: PointsInput): PointsBreakdown {
  const fraction = clamp01(input.fraction);
  const max = Math.max(0, input.basePoints) * Math.max(0, input.multiplier) * fraction;
  if (max <= 0) return { correctness: 0, speed: 0, total: 0 };
  if (!input.speedBonus) {
    const total = Math.round(max);
    return { correctness: total, speed: 0, total };
  }
  const elapsed = input.timeLimitMs > 0 ? clamp01(input.responseMs / input.timeLimitMs) : 1;
  const correctness = Math.round(max / 2);
  const speed = Math.round((max / 2) * (1 - elapsed));
  return { correctness, speed, total: correctness + speed };
}
