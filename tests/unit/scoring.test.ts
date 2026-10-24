import { describe, expect, it } from "vitest";
import { AnswerError, resolveAnswer } from "@/lib/domain/answers";
import { publicId } from "@/lib/domain/random";
import { rightSideId, toPublicQuestion } from "@/lib/domain/public-view";
import { computePoints, evaluateAnswer, pinDistance, toleranceEvaluation } from "@/lib/domain/scoring";
import type { Question } from "@/lib/domain/schema";
import * as f from "./fixtures";

const SEED = "test-seed";
const pid = (id: string) => publicId(SEED, id);

function grade(question: Question, payload: unknown) {
  return evaluateAnswer(question, resolveAnswer(question, payload, SEED));
}

describe("single choice", () => {
  const q = f.singleChoice();
  it("awards the correct option", () => {
    expect(grade(q, { optionId: pid(q.config.options[1]!.id) })).toMatchObject({ status: "correct", fraction: 1 });
  });
  it("rejects a wrong option", () => {
    expect(grade(q, { optionId: pid(q.config.options[0]!.id) })).toMatchObject({ status: "incorrect", fraction: 0 });
  });
  it("rejects real (non-public) IDs and unknown IDs", () => {
    expect(() => grade(q, { optionId: q.config.options[1]!.id })).toThrow(AnswerError);
    expect(() => grade(q, { optionId: "nope" })).toThrow(AnswerError);
  });
  it("rejects malformed payloads", () => {
    expect(() => grade(q, { optionIds: [] })).toThrow(AnswerError);
    expect(() => grade(q, null)).toThrow(AnswerError);
  });
});

describe("image choice", () => {
  const q = f.imageChoice();
  it("grades like single choice", () => {
    expect(grade(q, { optionId: pid(q.config.options[2]!.id) }).isCorrect).toBe(true);
    expect(grade(q, { optionId: pid(q.config.options[0]!.id) }).isCorrect).toBe(false);
  });
});

describe("multi select", () => {
  it("requires the exact set without partial credit", () => {
    const q = f.multiSelect(false);
    const [a, b, c] = q.config.options.map((o) => pid(o.id));
    expect(grade(q, { optionIds: [a, c] }).status).toBe("correct");
    expect(grade(q, { optionIds: [c, a] }).status).toBe("correct");
    expect(grade(q, { optionIds: [a] }).status).toBe("incorrect");
    expect(grade(q, { optionIds: [a, b, c] }).status).toBe("incorrect");
  });
  it("gives partial credit = (right − wrong) / correctTotal, never negative", () => {
    const q = f.multiSelect(true);
    const [a, b, c, d] = q.config.options.map((o) => pid(o.id));
    expect(grade(q, { optionIds: [a] })).toMatchObject({ status: "partial", fraction: 0.5 });
    expect(grade(q, { optionIds: [a, b, c] })).toMatchObject({ status: "partial", fraction: 0.5 });
    expect(grade(q, { optionIds: [b, d] })).toMatchObject({ status: "incorrect", fraction: 0 });
    expect(grade(q, { optionIds: [a, b, d] })).toMatchObject({ status: "incorrect", fraction: 0 });
  });
  it("rejects duplicate and empty selections", () => {
    const q = f.multiSelect();
    const a = pid(q.config.options[0]!.id);
    expect(() => grade(q, { optionIds: [a, a] })).toThrow(AnswerError);
    expect(() => grade(q, { optionIds: [] })).toThrow(AnswerError);
  });
});

describe("true / false", () => {
  it("matches the configured value", () => {
    expect(grade(f.trueFalse(true), { value: true }).isCorrect).toBe(true);
    expect(grade(f.trueFalse(true), { value: false }).isCorrect).toBe(false);
    expect(grade(f.trueFalse(false), { value: false }).isCorrect).toBe(true);
  });
});

describe("slider", () => {
  it("is fully correct on the target", () => {
    expect(grade(f.slider(), { value: 1831 })).toMatchObject({ status: "correct", fraction: 1 });
  });
  it("grades 50–100% inside the tolerance", () => {
    const halfway = grade(f.slider(), { value: 1881 });
    expect(halfway.isCorrect).toBe(true);
    expect(halfway.fraction).toBeCloseTo(0.75);
    expect(grade(f.slider(), { value: 1931 }).fraction).toBeCloseTo(0.5);
  });
  it("is incorrect outside the tolerance", () => {
    expect(grade(f.slider(), { value: 1932 })).toMatchObject({ status: "incorrect", fraction: 0 });
  });
  it("awards full points anywhere inside tolerance when grading is off", () => {
    expect(grade(f.slider({ graded: false }), { value: 1900 }).fraction).toBe(1);
  });
  it("supports exact-match mode", () => {
    const q = f.slider({ exactMatch: true });
    expect(grade(q, { value: 1831 }).isCorrect).toBe(true);
    expect(grade(q, { value: 1832 }).isCorrect).toBe(false);
  });
  it("snaps to the step and rejects out-of-range values", () => {
    const q = f.slider({ min: 0, max: 1, step: 0.1, target: 0.3, tolerance: 0, exactMatch: true });
    expect(resolveAnswer(q, { value: 0.30000000004 }, SEED)).toEqual({ type: "slider", value: 0.3 });
    expect(grade(q, { value: 0.1 + 0.2 }).isCorrect).toBe(true);
    expect(() => grade(q, { value: 2 })).toThrow(AnswerError);
  });
});

describe("numeric", () => {
  it("requires the exact number by default", () => {
    expect(grade(f.numeric(), { value: 206 }).isCorrect).toBe(true);
    expect(grade(f.numeric(), { value: 205 }).isCorrect).toBe(false);
  });
  it("applies tolerance", () => {
    const q = f.numeric({ tolerance: 2 });
    expect(grade(q, { value: 204 }).isCorrect).toBe(true);
    expect(grade(q, { value: 203 }).isCorrect).toBe(false);
  });
  it("handles decimals precisely", () => {
    const q = f.numeric({ target: 3.14, tolerance: 0.01, allowDecimals: true });
    expect(grade(q, { value: 3.15 }).isCorrect).toBe(true);
    expect(grade(q, { value: 3.16 }).isCorrect).toBe(false);
  });
  it("rejects decimals when not allowed and enforces min/max", () => {
    expect(() => grade(f.numeric(), { value: 206.5 })).toThrow(AnswerError);
    const bounded = f.numeric({ min: 0, max: 300 });
    expect(() => grade(bounded, { value: -1 })).toThrow(AnswerError);
    expect(() => grade(bounded, { value: 301 })).toThrow(AnswerError);
  });
  it("rejects non-finite numbers", () => {
    expect(() => grade(f.numeric(), { value: Number.NaN })).toThrow(AnswerError);
    expect(() => grade(f.numeric(), { value: "206" })).toThrow(AnswerError);
  });
});

describe("short answer", () => {
  it("matches case-insensitively and ignores surrounding whitespace by default", () => {
    const q = f.shortAnswer();
    expect(grade(q, { text: "  sava " }).isCorrect).toBe(true);
    expect(grade(q, { text: "SAVA" }).isCorrect).toBe(true);
    expect(grade(q, { text: "Drava" }).isCorrect).toBe(false);
  });
  it("is accent-insensitive unless configured otherwise", () => {
    const q = f.shortAnswer({ acceptedAnswers: ["Čakovec"] });
    expect(grade(q, { text: "cakovec" }).isCorrect).toBe(true);
    const strict = f.shortAnswer({ acceptedAnswers: ["Čakovec"], accentSensitive: true });
    expect(grade(strict, { text: "Cakovec" }).isCorrect).toBe(false);
    expect(grade(strict, { text: "čakovec" }).isCorrect).toBe(true);
  });
  it("handles đ, which has no Unicode decomposition", () => {
    const q = f.shortAnswer({ acceptedAnswers: ["Đakovo"] });
    expect(grade(q, { text: "dakovo" }).isCorrect).toBe(true);
  });
  it("respects case sensitivity", () => {
    const q = f.shortAnswer({ caseSensitive: true });
    expect(grade(q, { text: "sava" }).isCorrect).toBe(false);
  });
  it("accepts alternative spellings", () => {
    const q = f.shortAnswer({ acceptedAnswers: ["Dubrovnik", "Ragusa"] });
    expect(grade(q, { text: "ragusa" }).isCorrect).toBe(true);
  });
  it("collapses inner whitespace only when normalisation is on", () => {
    const q = f.shortAnswer({ acceptedAnswers: ["Plitvička jezera"] });
    expect(grade(q, { text: "plitvička    jezera" }).isCorrect).toBe(true);
    const raw = f.shortAnswer({ acceptedAnswers: ["Plitvička jezera"], normalizeWhitespace: false });
    expect(grade(raw, { text: " Plitvička jezera" }).isCorrect).toBe(false);
  });
  it("does not use fuzzy matching", () => {
    expect(grade(f.shortAnswer(), { text: "Savva" }).isCorrect).toBe(false);
    expect(grade(f.shortAnswer(), { text: "Sava river" }).isCorrect).toBe(false);
  });
  it("puts unmatched answers into review when manual review is on", () => {
    const q = f.shortAnswer({ manualReview: true });
    expect(grade(q, { text: "rijeka Sava" })).toEqual({ status: "pending_review", fraction: 0, isCorrect: null });
    expect(grade(q, { text: "Sava" }).status).toBe("correct");
  });
  it("rejects empty and over-long answers", () => {
    expect(() => grade(f.shortAnswer(), { text: "   " })).toThrow(AnswerError);
    expect(() => grade(f.shortAnswer({ maxLength: 5 }), { text: "predugo" })).toThrow(AnswerError);
  });
});

describe("pin on image", () => {
  it("measures distance in image-width units, respecting aspect ratio", () => {
    // 2:1 image — moving 0.1 of the height is 0.05 of the width.
    expect(pinDistance({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 }, 2)).toBeCloseTo(0.05);
    expect(pinDistance({ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }, 2)).toBeCloseTo(0.1);
  });
  it("is fully correct on the target and graded inside the radius", () => {
    const q = f.pinImage();
    expect(grade(q, { x: 0.5, y: 0.5 }).fraction).toBe(1);
    const near = grade(q, { x: 0.55, y: 0.5 });
    expect(near.isCorrect).toBe(true);
    expect(near.fraction).toBeCloseTo(0.75);
  });
  it("is incorrect outside the radius", () => {
    expect(grade(f.pinImage(), { x: 0.75, y: 0.5 }).isCorrect).toBe(false);
  });
  it("works the same on a portrait image", () => {
    const q = f.pinImage(500, 1000);
    // aspect 0.5: a vertical offset of 0.04 of the height = 0.08 of the width.
    expect(grade(q, { x: 0.5, y: 0.54 }).isCorrect).toBe(true);
    expect(grade(q, { x: 0.5, y: 0.56 }).isCorrect).toBe(false);
  });
  it("rejects coordinates outside the image", () => {
    expect(() => grade(f.pinImage(), { x: 1.2, y: 0.5 })).toThrow(AnswerError);
  });
});

describe("ordering", () => {
  it("is correct only for the exact sequence and partial by position", () => {
    const q = f.ordering(true);
    const ids = q.config.items.map((i) => pid(i.id));
    expect(grade(q, { order: ids }).status).toBe("correct");
    const swapped = [ids[1], ids[0], ids[2], ids[3]];
    expect(grade(q, { order: swapped })).toMatchObject({ status: "partial", fraction: 0.5 });
    expect(grade(q, { order: [...ids].reverse() })).toMatchObject({ status: "incorrect", fraction: 0 });
  });
  it("gives nothing for a partly right order without partial credit", () => {
    const q = f.ordering(false);
    const ids = q.config.items.map((i) => pid(i.id));
    expect(grade(q, { order: [ids[1], ids[0], ids[2], ids[3]] }).fraction).toBe(0);
  });
  it("requires a full permutation", () => {
    const q = f.ordering();
    const ids = q.config.items.map((i) => pid(i.id));
    expect(() => grade(q, { order: ids.slice(0, 3) })).toThrow(AnswerError);
    expect(() => grade(q, { order: [ids[0], ids[0], ids[1], ids[2]] })).toThrow(AnswerError);
  });
});

describe("matching", () => {
  const leftId = (q: ReturnType<typeof f.matching>, i: number) => pid(q.config.pairs[i]!.id);
  const rightId = (q: ReturnType<typeof f.matching>, i: number) => rightSideId(SEED, q.config.pairs[i]!.id);

  it("is correct when every pair matches", () => {
    const q = f.matching();
    const matches = Object.fromEntries([0, 1, 2].map((i) => [leftId(q, i), rightId(q, i)]));
    expect(grade(q, { matches }).status).toBe("correct");
  });
  it("gives partial credit per correct pair", () => {
    const q = f.matching(true);
    const matches = { [leftId(q, 0)]: rightId(q, 0), [leftId(q, 1)]: rightId(q, 2), [leftId(q, 2)]: rightId(q, 1) };
    const result = grade(q, { matches });
    expect(result.status).toBe("partial");
    expect(result.fraction).toBeCloseTo(1 / 3);
  });
  it("rejects using one right item twice", () => {
    const q = f.matching();
    expect(() => grade(q, { matches: { [leftId(q, 0)]: rightId(q, 0), [leftId(q, 1)]: rightId(q, 0) } })).toThrow(
      AnswerError,
    );
  });
  it("never exposes the pairing through IDs", () => {
    const q = f.matching();
    const view = toPublicQuestion(q, { seed: SEED, randomizeAnswers: false, timeLimit: 20 });
    if (view.config.type !== "matching") throw new Error("wrong type");
    const leftIds = new Set(view.config.left.map((l) => l.id));
    expect(view.config.right.some((r) => leftIds.has(r.id))).toBe(false);
  });
});

describe("ungraded types", () => {
  it("polls and rankings never produce correctness", () => {
    const p = f.poll();
    expect(grade(p, { optionId: pid(p.config.options[0]!.id) })).toEqual({ status: "ungraded", fraction: 0, isCorrect: null });
    const r = f.ranking();
    expect(grade(r, { order: r.config.options.map((o) => pid(o.id)) }).status).toBe("ungraded");
  });
});

describe("tolerance evaluation edge cases", () => {
  it("treats zero tolerance as exact", () => {
    expect(toleranceEvaluation(0, 0, true).isCorrect).toBe(true);
    expect(toleranceEvaluation(0.001, 0, true).isCorrect).toBe(false);
  });
});

describe("points", () => {
  const base = { basePoints: 1000, multiplier: 1, speedBonus: true, timeLimitMs: 20_000 };
  it("pays half for correctness and up to half for speed", () => {
    expect(computePoints({ ...base, fraction: 1, responseMs: 0 })).toEqual({ correctness: 500, speed: 500, total: 1000 });
    expect(computePoints({ ...base, fraction: 1, responseMs: 10_000 }).total).toBe(750);
    expect(computePoints({ ...base, fraction: 1, responseMs: 20_000 }).total).toBe(500);
  });
  it("clamps late responses and never goes negative", () => {
    expect(computePoints({ ...base, fraction: 1, responseMs: 99_000 }).total).toBe(500);
    expect(computePoints({ ...base, fraction: -1, responseMs: 0 }).total).toBe(0);
    expect(computePoints({ ...base, fraction: 1, responseMs: -50 }).total).toBe(1000);
  });
  it("scales with partial credit and multiplier", () => {
    expect(computePoints({ ...base, fraction: 0.5, responseMs: 0 }).total).toBe(500);
    expect(computePoints({ ...base, fraction: 1, multiplier: 2, responseMs: 0 }).total).toBe(2000);
    expect(computePoints({ ...base, fraction: 1, multiplier: 0, responseMs: 0 }).total).toBe(0);
  });
  it("awards the full base without speed bonus", () => {
    expect(computePoints({ ...base, speedBonus: false, fraction: 1, responseMs: 19_000 }).total).toBe(1000);
  });
});
