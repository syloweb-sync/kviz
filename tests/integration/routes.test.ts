import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as joinRoute } from "@/app/api/join/route";
import { createGame } from "@/lib/server/games/service";
import { createQuiz } from "@/lib/server/quizzes";
import * as f from "../unit/fixtures";
import { createUser } from "./helpers";

function lookup(pin: string, ip: string) {
  return joinRoute(
    new Request("http://localhost/api/join", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ pin }),
    }),
  );
}

describe("PIN lookup route", () => {
  it("lets a whole classroom behind one IP look up a valid PIN", async () => {
    const host = await createUser("Učiteljica");
    const quizId = await createQuiz(host.client, host.id, { title: "Razred", description: "", coverImage: null, category: null, tags: [], questions: [f.trueFalse()] });
    const { pin } = await createGame(host.id, { quizId, mode: "classic", settings: {} });
    const ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}-${randomUUID()}`;
    const statuses = await Promise.all(Array.from({ length: 30 }, () => lookup(pin!, ip).then((r) => r.status)));
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("blocks an address after repeated wrong guesses, even for valid PINs", async () => {
    const host = await createUser("Domaćin");
    const quizId = await createQuiz(host.client, host.id, { title: "X", description: "", coverImage: null, category: null, tags: [], questions: [f.trueFalse()] });
    const { pin } = await createGame(host.id, { quizId, mode: "classic", settings: {} });
    const ip = `attacker-${randomUUID()}`;
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) statuses.push((await lookup(String(100000 + i).padStart(6, "0"), ip)).status);
    expect(statuses.slice(0, 12).every((s) => s === 404 || s === 200)).toBe(true);
    expect(statuses.slice(12)).toEqual([429, 429]);
    expect((await lookup(pin!, ip)).status).toBe(429);
    // Other addresses are unaffected.
    expect((await lookup(pin!, `other-${randomUUID()}`)).status).toBe(200);
  });
});
