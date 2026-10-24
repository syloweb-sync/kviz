import type { InternalAnswer } from "./answers";
import { normalizeAnswerText } from "./normalize";
import { publicId } from "./random";
import type { Question } from "./schema";
import type { EvaluationStatus } from "./scoring";

/** One graded answer as stored on the server. */
export interface GradedAnswer {
  playerId: string;
  nickname: string;
  answer: InternalAnswer;
  status: EvaluationStatus;
  fraction: number;
  points: number;
}

export type Distribution =
  | { kind: "options"; counts: Record<string, number>; voters: Record<string, string[]> | null }
  | { kind: "boolean"; trueCount: number; falseCount: number }
  | {
      kind: "numbers";
      average: number | null;
      median: number | null;
      buckets: { from: number; to: number; count: number }[];
    }
  | { kind: "texts"; groups: { text: string; count: number; status: EvaluationStatus }[] }
  | { kind: "points"; points: { x: number; y: number; correct: boolean }[] }
  | { kind: "sequence"; fullyCorrect: number; positionAccuracy: Record<string, number> }
  | { kind: "matching"; fullyCorrect: number; pairAccuracy: Record<string, number> }
  | { kind: "ranking"; order: { id: string; score: number; averagePosition: number }[] };

export interface QuestionStats {
  responseCount: number;
  correctCount: number;
  partialCount: number;
  pendingCount: number;
  averagePoints: number;
  distribution: Distribution;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function buckets(values: number[], lo: number, hi: number, count = 10) {
  if (values.length === 0) return [];
  if (hi <= lo) return [{ from: lo, to: hi, count: values.length }];
  const width = (hi - lo) / count;
  const result = Array.from({ length: count }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0 }));
  for (const v of values) {
    const index = Math.min(count - 1, Math.max(0, Math.floor((v - lo) / width)));
    (result[index] as { count: number }).count++;
  }
  return result;
}

export function buildQuestionStats(question: Question, answers: readonly GradedAnswer[], seed: string): QuestionStats {
  const pid = (id: string) => publicId(seed, id);
  const responseCount = answers.length;
  const correctCount = answers.filter((a) => a.status === "correct").length;
  const partialCount = answers.filter((a) => a.status === "partial").length;
  const pendingCount = answers.filter((a) => a.status === "pending_review").length;
  const averagePoints = responseCount ? Math.round(answers.reduce((s, a) => s + a.points, 0) / responseCount) : 0;

  const distribution = ((): Distribution => {
    switch (question.type) {
      case "single_choice":
      case "image_choice":
      case "poll":
      case "multi_select": {
        const counts: Record<string, number> = {};
        const voters: Record<string, string[]> = {};
        for (const o of question.config.options) {
          counts[pid(o.id)] = 0;
          voters[pid(o.id)] = [];
        }
        for (const a of answers) {
          const ids =
            a.answer.type === "multi_select"
              ? a.answer.optionIds
              : "optionId" in a.answer
                ? [a.answer.optionId]
                : [];
          for (const id of ids) {
            const key = pid(id);
            if (key in counts) {
              counts[key] = (counts[key] ?? 0) + 1;
              voters[key]?.push(a.nickname);
            }
          }
        }
        const showVoters = question.type === "poll" && question.config.showVoterNames;
        return { kind: "options", counts, voters: showVoters ? voters : null };
      }
      case "true_false": {
        let trueCount = 0;
        let falseCount = 0;
        for (const a of answers) {
          if (a.answer.type !== "true_false") continue;
          if (a.answer.value) trueCount++;
          else falseCount++;
        }
        return { kind: "boolean", trueCount, falseCount };
      }
      case "slider":
      case "numeric": {
        const values = answers.flatMap((a) => (a.answer.type === question.type ? [a.answer.value] : []));
        const average = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
        let lo: number;
        let hi: number;
        if (question.type === "slider") {
          lo = question.config.min;
          hi = question.config.max;
        } else {
          const all = question.config.target !== null ? [...values, question.config.target] : values;
          lo = all.length ? Math.min(...all) : 0;
          hi = all.length ? Math.max(...all) : 0;
        }
        return { kind: "numbers", average, median: median(values), buckets: buckets(values, lo, hi) };
      }
      case "short_answer": {
        const groups = new Map<string, { text: string; count: number; status: EvaluationStatus }>();
        for (const a of answers) {
          if (a.answer.type !== "short_answer") continue;
          const key = normalizeAnswerText(a.answer.text, { ...question.config, normalizeWhitespace: true });
          const existing = groups.get(key);
          if (existing) existing.count++;
          else groups.set(key, { text: a.answer.text.trim(), count: 1, status: a.status });
        }
        return { kind: "texts", groups: [...groups.values()].sort((x, y) => y.count - x.count).slice(0, 12) };
      }
      case "pin_image":
        return {
          kind: "points",
          points: answers.flatMap((a) =>
            a.answer.type === "pin_image" ? [{ x: a.answer.x, y: a.answer.y, correct: a.status === "correct" }] : [],
          ),
        };
      case "ordering": {
        const items = question.config.items;
        const positionAccuracy: Record<string, number> = {};
        items.forEach((item, index) => {
          const hits = answers.filter((a) => a.answer.type === "ordering" && a.answer.order[index] === item.id).length;
          positionAccuracy[pid(item.id)] = responseCount ? hits / responseCount : 0;
        });
        return { kind: "sequence", fullyCorrect: correctCount, positionAccuracy };
      }
      case "matching": {
        const pairAccuracy: Record<string, number> = {};
        for (const pair of question.config.pairs) {
          const hits = answers.filter((a) => a.answer.type === "matching" && a.answer.matches[pair.id] === pair.id).length;
          pairAccuracy[pid(pair.id)] = responseCount ? hits / responseCount : 0;
        }
        return { kind: "matching", fullyCorrect: correctCount, pairAccuracy };
      }
      case "ranking": {
        // Borda count: first place earns n−1 points, last place 0.
        const options = question.config.options;
        const n = options.length;
        const score = new Map(options.map((o) => [o.id, 0]));
        const positions = new Map(options.map((o) => [o.id, 0]));
        let ballots = 0;
        for (const a of answers) {
          if (a.answer.type !== "ranking") continue;
          ballots++;
          a.answer.order.forEach((id, index) => {
            score.set(id, (score.get(id) ?? 0) + (n - 1 - index));
            positions.set(id, (positions.get(id) ?? 0) + index + 1);
          });
        }
        const order = options
          .map((o) => ({
            id: pid(o.id),
            score: score.get(o.id) ?? 0,
            averagePosition: ballots ? (positions.get(o.id) ?? 0) / ballots : 0,
          }))
          .sort((x, y) => y.score - x.score || x.averagePosition - y.averagePosition);
        return { kind: "ranking", order };
      }
    }
  })();

  return { responseCount, correctCount, partialCount, pendingCount, averagePoints, distribution };
}
