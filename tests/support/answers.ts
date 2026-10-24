import { publicId } from "@/lib/domain/random";
import { rightSideId } from "@/lib/domain/public-view";
import type { Question } from "@/lib/domain/schema";

/** Public payload that answers `question` correctly (any valid answer for polls/rankings). */
export function correctPayload(question: Question, seed: string): unknown {
  const pid = (id: string) => publicId(seed, id);
  switch (question.type) {
    case "single_choice":
    case "image_choice":
      return { optionId: pid(question.config.correctOptionId!) };
    case "multi_select":
      return { optionIds: question.config.correctOptionIds.map(pid) };
    case "true_false":
      return { value: question.config.correct };
    case "slider":
    case "numeric":
      return { value: question.config.target };
    case "short_answer":
      return { text: question.config.acceptedAnswers[0] };
    case "pin_image":
      return question.config.target;
    case "ordering":
      return { order: question.config.items.map((i) => pid(i.id)) };
    case "matching":
      return { matches: Object.fromEntries(question.config.pairs.map((p) => [pid(p.id), rightSideId(seed, p.id)])) };
    case "poll":
      return { optionId: pid(question.config.options[0]!.id) };
    case "ranking":
      return { order: question.config.options.map((o) => pid(o.id)) };
  }
}

/** Public payload that is valid but wrong. */
export function wrongPayload(question: Question, seed: string): unknown {
  const pid = (id: string) => publicId(seed, id);
  switch (question.type) {
    case "single_choice":
    case "image_choice": {
      const wrong = question.config.options.find((o) => o.id !== question.config.correctOptionId)!;
      return { optionId: pid(wrong.id) };
    }
    case "multi_select": {
      const wrong = question.config.options.filter((o) => !question.config.correctOptionIds.includes(o.id));
      return { optionIds: wrong.map((o) => pid(o.id)) };
    }
    case "true_false":
      return { value: !question.config.correct };
    case "slider":
      return { value: question.config.target! > (question.config.min + question.config.max) / 2 ? question.config.min : question.config.max };
    case "numeric":
      return { value: question.config.target! + question.config.tolerance + 1 };
    case "short_answer":
      return { text: "sasvim krivi odgovor" };
    case "pin_image": {
      const t = question.config.target!;
      return { x: t.x > 0.5 ? 0 : 1, y: t.y > 0.5 ? 0 : 1 };
    }
    case "ordering":
      return { order: [...question.config.items].reverse().map((i) => pid(i.id)) };
    case "matching": {
      const pairs = question.config.pairs;
      return {
        matches: Object.fromEntries(
          pairs.map((p, i) => [pid(p.id), rightSideId(seed, pairs[(i + 1) % pairs.length]!.id)]),
        ),
      };
    }
    case "poll":
      return { optionId: pid(question.config.options[1]!.id) };
    case "ranking":
      return { order: [...question.config.options].reverse().map((o) => pid(o.id)) };
  }
}
