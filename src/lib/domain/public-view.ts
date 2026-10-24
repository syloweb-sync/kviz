import { publicId, shuffle, shuffleAwayFrom } from "./random";
import type { MediaRef, NormalizedPoint, PointsMode, Question, QuestionType } from "./schema";

/**
 * Public (player-facing) projection of a question. It contains everything needed to render
 * and answer the question, and nothing that reveals the correct answer:
 *  - option/item IDs are replaced by per-game derived IDs,
 *  - correct-answer fields, targets, tolerances and accepted answers are removed,
 *  - ordering/matching/ranking items are shuffled.
 */

export interface PublicOption {
  id: string;
  text: string;
  media: MediaRef | null;
}

export interface PublicImageOption {
  id: string;
  media: MediaRef | null;
  caption: string;
}

export interface PublicItem {
  id: string;
  text: string;
}

export type PublicConfig =
  | { type: "single_choice"; options: PublicOption[] }
  | { type: "multi_select"; options: PublicOption[] }
  | { type: "true_false" }
  | { type: "slider"; min: number; max: number; step: number; unit: string }
  | { type: "short_answer"; multiline: boolean; maxLength: number }
  | { type: "numeric"; allowDecimals: boolean; unit: string; min: number | null; max: number | null }
  | { type: "pin_image"; image: MediaRef | null }
  | { type: "ordering"; items: PublicItem[] }
  | {
      type: "matching";
      left: { id: string; text: string; media: MediaRef | null }[];
      right: { id: string; text: string; media: MediaRef | null }[];
    }
  | { type: "image_choice"; options: PublicImageOption[] }
  | { type: "poll"; options: PublicOption[] }
  | { type: "ranking"; options: PublicItem[] };

export interface PublicQuestion {
  id: string;
  type: QuestionType;
  title: string;
  media: MediaRef | null;
  timeLimit: number;
  points: PointsMode;
  feedback: "on_close" | "immediate";
  config: PublicConfig;
}

export interface PublicViewOptions {
  /** Secret, per-game seed. Clients never learn it. */
  seed: string;
  randomizeAnswers: boolean;
  timeLimit: number;
}

/** Right-hand matching items must not share an ID with their left partner. */
export function rightSideId(seed: string, pairId: string): string {
  return publicId(`${seed}:right`, pairId);
}

export function toPublicQuestion(question: Question, options: PublicViewOptions): PublicQuestion {
  const { seed } = options;
  const pid = (realId: string) => publicId(seed, realId);
  const orderSeed = `${seed}:${question.id}`;
  const maybeShuffle = <T,>(items: T[]) => (options.randomizeAnswers ? shuffle(items, orderSeed) : items);

  const config = ((): PublicConfig => {
    switch (question.type) {
      case "single_choice":
      case "multi_select":
      case "poll":
        return {
          type: question.type,
          options: maybeShuffle(question.config.options).map((o) => ({ id: pid(o.id), text: o.text, media: o.media })),
        };
      case "image_choice":
        return {
          type: "image_choice",
          options: maybeShuffle(question.config.options).map((o) => ({
            id: pid(o.id),
            media: o.media,
            caption: o.caption,
          })),
        };
      case "true_false":
        return { type: "true_false" };
      case "slider": {
        const { min, max, step, unit } = question.config;
        return { type: "slider", min, max, step, unit };
      }
      case "short_answer":
        return {
          type: "short_answer",
          multiline: question.config.multiline,
          maxLength: question.config.maxLength,
        };
      case "numeric": {
        const { allowDecimals, unit, min, max } = question.config;
        return { type: "numeric", allowDecimals, unit, min, max };
      }
      case "pin_image":
        return { type: "pin_image", image: question.config.image };
      case "ordering":
        return {
          type: "ordering",
          items: shuffleAwayFrom(question.config.items, orderSeed).map((i) => ({ id: pid(i.id), text: i.text })),
        };
      case "ranking":
        return {
          type: "ranking",
          options: shuffle(question.config.options, orderSeed).map((i) => ({ id: pid(i.id), text: i.text })),
        };
      case "matching": {
        const pairs = question.config.pairs;
        const left = (options.randomizeAnswers ? shuffle(pairs, `${orderSeed}:l`) : pairs).map((p) => ({
          id: pid(p.id),
          text: p.left,
          media: p.leftMedia,
        }));
        const right = shuffleAwayFrom(pairs, `${orderSeed}:r`).map((p) => ({
          id: rightSideId(seed, p.id),
          text: p.right,
          media: p.rightMedia,
        }));
        return { type: "matching", left, right };
      }
    }
  })();

  return {
    id: question.id,
    type: question.type,
    title: question.title,
    media: question.type === "pin_image" ? null : question.media,
    timeLimit: options.timeLimit,
    points: question.points,
    feedback: question.feedback,
    config,
  };
}

/**
 * The correct answer expressed in public IDs. Only sent to clients once a question has been
 * closed (or to a single player who already submitted, when the question uses immediate feedback).
 */
export type RevealedAnswer =
  | { type: "single_choice" | "image_choice"; correctOptionId: string | null }
  | { type: "multi_select"; correctOptionIds: string[] }
  | { type: "true_false"; correct: boolean | null }
  | { type: "slider"; target: number | null; tolerance: number; exactMatch: boolean; unit: string }
  | { type: "short_answer"; acceptedAnswers: string[] }
  | { type: "numeric"; target: number | null; tolerance: number; unit: string }
  | { type: "pin_image"; target: NormalizedPoint | null; radius: number }
  | { type: "ordering"; correctOrder: string[] }
  | { type: "matching"; pairs: { leftId: string; rightId: string }[] }
  | { type: "poll" }
  | { type: "ranking" };

export function toRevealedAnswer(question: Question, seed: string): RevealedAnswer {
  const pid = (realId: string) => publicId(seed, realId);
  switch (question.type) {
    case "single_choice":
    case "image_choice":
      return {
        type: question.type,
        correctOptionId: question.config.correctOptionId ? pid(question.config.correctOptionId) : null,
      };
    case "multi_select":
      return { type: "multi_select", correctOptionIds: question.config.correctOptionIds.map(pid) };
    case "true_false":
      return { type: "true_false", correct: question.config.correct };
    case "slider": {
      const { target, tolerance, exactMatch, unit } = question.config;
      return { type: "slider", target, tolerance: exactMatch ? 0 : tolerance, exactMatch, unit };
    }
    case "short_answer":
      return {
        type: "short_answer",
        acceptedAnswers: question.config.acceptedAnswers.map((a) => a.trim()).filter(Boolean),
      };
    case "numeric":
      return {
        type: "numeric",
        target: question.config.target,
        tolerance: question.config.tolerance,
        unit: question.config.unit,
      };
    case "pin_image":
      return { type: "pin_image", target: question.config.target, radius: question.config.radius };
    case "ordering":
      return { type: "ordering", correctOrder: question.config.items.map((i) => pid(i.id)) };
    case "matching":
      return {
        type: "matching",
        pairs: question.config.pairs.map((p) => ({ leftId: pid(p.id), rightId: rightSideId(seed, p.id) })),
      };
    case "poll":
      return { type: "poll" };
    case "ranking":
      return { type: "ranking" };
  }
}
