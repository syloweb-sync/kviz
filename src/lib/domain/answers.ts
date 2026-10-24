import { z } from "zod";
import { publicId } from "./random";
import { rightSideId } from "./public-view";
import type { Question, QuestionType } from "./schema";

/**
 * Answer payloads as sent by players (public IDs), and their resolved internal form
 * (real IDs) that the scoring engine evaluates. Resolution fails for any ID that does not
 * belong to the question, so tampered payloads are rejected rather than scored.
 */

const pubId = z.string().min(1).max(64);

export const publicAnswerSchemas = {
  single_choice: z.object({ optionId: pubId }),
  image_choice: z.object({ optionId: pubId }),
  poll: z.object({ optionId: pubId }),
  multi_select: z.object({ optionIds: z.array(pubId).max(6) }),
  true_false: z.object({ value: z.boolean() }),
  slider: z.object({ value: z.number().finite() }),
  numeric: z.object({ value: z.number().finite() }),
  short_answer: z.object({ text: z.string().max(400) }),
  pin_image: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  ordering: z.object({ order: z.array(pubId).max(8) }),
  ranking: z.object({ order: z.array(pubId).max(8) }),
  matching: z.object({ matches: z.record(pubId, pubId) }),
} satisfies Record<QuestionType, z.ZodType>;

export type PublicAnswer<T extends QuestionType = QuestionType> = z.infer<(typeof publicAnswerSchemas)[T]>;

export type InternalAnswer =
  | { type: "single_choice" | "image_choice" | "poll"; optionId: string }
  | { type: "multi_select"; optionIds: string[] }
  | { type: "true_false"; value: boolean }
  | { type: "slider" | "numeric"; value: number }
  | { type: "short_answer"; text: string }
  | { type: "pin_image"; x: number; y: number }
  | { type: "ordering" | "ranking"; order: string[] }
  /** leftPairId → rightPairId */
  | { type: "matching"; matches: Record<string, string> };

export class AnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnswerError";
  }
}

function buildReverseMap(seed: string, realIds: string[], derive = publicId): Map<string, string> {
  return new Map(realIds.map((id) => [derive(seed, id), id]));
}

function resolveIds(map: Map<string, string>, ids: string[]): string[] {
  return ids.map((id) => {
    const real = map.get(id);
    if (!real) throw new AnswerError("Odgovor sadrži nepoznatu opciju.");
    return real;
  });
}

function assertPermutation(order: string[], expected: string[]) {
  if (order.length !== expected.length || new Set(order).size !== order.length) {
    throw new AnswerError("Poredak mora sadržavati sve stavke točno jednom.");
  }
  const set = new Set(expected);
  if (!order.every((id) => set.has(id))) throw new AnswerError("Poredak sadrži nepoznatu stavku.");
}

/** Validates a raw payload against the question and converts public IDs to real ones. */
export function resolveAnswer(question: Question, raw: unknown, seed: string): InternalAnswer {
  const schema = publicAnswerSchemas[question.type];
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AnswerError("Neispravan oblik odgovora.");
  const data = parsed.data as Record<string, unknown>;

  switch (question.type) {
    case "single_choice":
    case "image_choice":
    case "poll": {
      const map = buildReverseMap(seed, question.config.options.map((o) => o.id));
      const [optionId] = resolveIds(map, [data.optionId as string]);
      return { type: question.type, optionId: optionId as string };
    }
    case "multi_select": {
      const map = buildReverseMap(seed, question.config.options.map((o) => o.id));
      const ids = resolveIds(map, data.optionIds as string[]);
      if (new Set(ids).size !== ids.length) throw new AnswerError("Opcija je odabrana više puta.");
      if (ids.length === 0) throw new AnswerError("Odaberite barem jedan odgovor.");
      return { type: "multi_select", optionIds: ids };
    }
    case "true_false":
      return { type: "true_false", value: data.value as boolean };
    case "slider": {
      const { min, max, step } = question.config;
      const value = data.value as number;
      if (value < min || value > max) throw new AnswerError("Vrijednost je izvan raspona.");
      // Snap to the configured step to remove floating point noise from the client.
      const snapped = Math.round((value - min) / step) * step + min;
      const decimals = (step.toString().split(".")[1] ?? "").length;
      return { type: "slider", value: Number(Math.min(max, snapped).toFixed(decimals)) };
    }
    case "numeric": {
      const value = data.value as number;
      const { allowDecimals, min, max } = question.config;
      if (!allowDecimals && !Number.isInteger(value)) throw new AnswerError("Upišite cijeli broj.");
      if (min !== null && value < min) throw new AnswerError(`Broj mora biti barem ${min}.`);
      if (max !== null && value > max) throw new AnswerError(`Broj smije biti najviše ${max}.`);
      return { type: "numeric", value };
    }
    case "short_answer": {
      const text = (data.text as string).normalize("NFC");
      if (text.trim().length === 0) throw new AnswerError("Upišite odgovor.");
      if (text.length > question.config.maxLength) throw new AnswerError("Odgovor je predugačak.");
      return { type: "short_answer", text };
    }
    case "pin_image":
      return { type: "pin_image", x: data.x as number, y: data.y as number };
    case "ordering":
    case "ranking": {
      const items = question.type === "ordering" ? question.config.items : question.config.options;
      const realIds = items.map((i) => i.id);
      const order = resolveIds(buildReverseMap(seed, realIds), data.order as string[]);
      assertPermutation(order, realIds);
      return { type: question.type, order };
    }
    case "matching": {
      const pairIds = question.config.pairs.map((p) => p.id);
      const leftMap = buildReverseMap(seed, pairIds);
      const rightMap = buildReverseMap(seed, pairIds, rightSideId);
      const matches: Record<string, string> = {};
      const usedRight = new Set<string>();
      for (const [leftPub, rightPub] of Object.entries(data.matches as Record<string, string>)) {
        const left = leftMap.get(leftPub);
        const right = rightMap.get(rightPub);
        if (!left || !right) throw new AnswerError("Par sadrži nepoznatu stavku.");
        if (usedRight.has(right)) throw new AnswerError("Desna stavka je spojena više puta.");
        usedRight.add(right);
        matches[left] = right;
      }
      if (Object.keys(matches).length === 0) throw new AnswerError("Spojite barem jedan par.");
      return { type: "matching", matches };
    }
  }
}

/** Converts a stored internal answer back to the public form (for restoring a player's UI). */
export function toPublicAnswer(answer: InternalAnswer, seed: string): Record<string, unknown> {
  const pid = (id: string) => publicId(seed, id);
  switch (answer.type) {
    case "single_choice":
    case "image_choice":
    case "poll":
      return { optionId: pid(answer.optionId) };
    case "multi_select":
      return { optionIds: answer.optionIds.map(pid) };
    case "true_false":
      return { value: answer.value };
    case "slider":
    case "numeric":
      return { value: answer.value };
    case "short_answer":
      return { text: answer.text };
    case "pin_image":
      return { x: answer.x, y: answer.y };
    case "ordering":
    case "ranking":
      return { order: answer.order.map(pid) };
    case "matching":
      return {
        matches: Object.fromEntries(
          Object.entries(answer.matches).map(([left, right]) => [pid(left), rightSideId(seed, right)]),
        ),
      };
  }
}
