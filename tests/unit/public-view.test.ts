import { describe, expect, it } from "vitest";
import { toPublicQuestion, toRevealedAnswer } from "@/lib/domain/public-view";
import type { Question } from "@/lib/domain/schema";
import { allQuestionTypes } from "./fixtures";
import * as f from "./fixtures";

const SEED = "secret-seed";
const view = (q: Question, randomizeAnswers = false) => toPublicQuestion(q, { seed: SEED, randomizeAnswers, timeLimit: 20 });

/** Every string inside the question's config that would reveal the answer if leaked. */
function secrets(q: Question): string[] {
  const realIds: string[] = [];
  const c = q.config as Record<string, unknown>;
  for (const key of ["options", "items", "pairs"]) {
    const list = c[key];
    if (Array.isArray(list)) realIds.push(...list.map((x: { id: string }) => x.id));
  }
  return realIds;
}

describe("public question view", () => {
  it.each(allQuestionTypes().map((q) => [q.type, q] as const))("%s leaks no answer data", (_type, q) => {
    const json = JSON.stringify(view(q));
    for (const id of secrets(q)) expect(json).not.toContain(id);
    for (const key of [
      "correctOptionId",
      "correctOptionIds",
      "correct\"",
      "target",
      "tolerance",
      "acceptedAnswers",
      "radius",
      "explanation",
      "partialCredit",
      "manualReview",
    ]) {
      expect(json).not.toContain(key);
    }
  });

  it("does not leak the slider target value", () => {
    const q = f.slider({ target: 1777, min: 0, max: 3000 });
    expect(JSON.stringify(view(q))).not.toContain("1777");
  });

  it("does not leak the numeric target value", () => {
    const q = f.numeric({ target: 4242 });
    expect(JSON.stringify(view(q))).not.toContain("4242");
  });

  it("does not leak accepted short answers", () => {
    expect(JSON.stringify(view(f.shortAnswer()))).not.toContain("Sava");
  });

  it("never starts an ordering question in the correct order", () => {
    for (let i = 0; i < 25; i++) {
      const q = f.ordering();
      const v = toPublicQuestion(q, { seed: `seed-${i}`, randomizeAnswers: false, timeLimit: 20 });
      if (v.config.type !== "ordering") throw new Error("wrong type");
      expect(v.config.items.map((x) => x.text)).not.toEqual(q.config.items.map((x) => x.text));
    }
  });

  it("is deterministic for the same seed", () => {
    const q = f.singleChoice();
    expect(view(q, true)).toEqual(view(q, true));
  });

  it("keeps option order when randomisation is off", () => {
    const q = f.singleChoice();
    const v = view(q, false);
    if (v.config.type !== "single_choice") throw new Error("wrong type");
    expect(v.config.options.map((o) => o.text)).toEqual(q.config.options.map((o) => o.text));
  });

  it("uses the effective time limit", () => {
    expect(toPublicQuestion(f.singleChoice(), { seed: SEED, randomizeAnswers: false, timeLimit: 7 }).timeLimit).toBe(7);
  });
});

describe("revealed answer", () => {
  it("maps correct options to public IDs", () => {
    const q = f.singleChoice();
    const v = view(q);
    const reveal = toRevealedAnswer(q, SEED);
    if (reveal.type !== "single_choice" || v.config.type !== "single_choice") throw new Error("wrong type");
    expect(v.config.options.find((o) => o.id === reveal.correctOptionId)?.text).toBe("Canberra");
  });

  it("reveals the ordering sequence using public IDs", () => {
    const q = f.ordering();
    const v = view(q);
    const reveal = toRevealedAnswer(q, SEED);
    if (reveal.type !== "ordering" || v.config.type !== "ordering") throw new Error("wrong type");
    const byId = new Map(v.config.items.map((i) => [i.id, i.text]));
    expect(reveal.correctOrder.map((id) => byId.get(id))).toEqual(q.config.items.map((i) => i.text));
  });

  it("reveals matching pairs that line up with the public sides", () => {
    const q = f.matching();
    const v = view(q);
    const reveal = toRevealedAnswer(q, SEED);
    if (reveal.type !== "matching" || v.config.type !== "matching") throw new Error("wrong type");
    const left = new Map(v.config.left.map((l) => [l.id, l.text]));
    const right = new Map(v.config.right.map((r) => [r.id, r.text]));
    const shown = reveal.pairs.map((p) => [left.get(p.leftId), right.get(p.rightId)]);
    expect(shown).toEqual(q.config.pairs.map((p) => [p.left, p.right]));
  });
});
