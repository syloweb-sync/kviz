import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createGame, joinGame, performAction } from "@/lib/server/games/service";
import { cleanupOrphanMedia, createQuiz } from "@/lib/server/quizzes";
import { getAdminSupabase } from "@/lib/supabase/server";
import * as f from "../unit/fixtures";
import { createUser } from "./helpers";

const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
function sql(statement: string) {
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-c", statement]);
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("storage access rules", () => {
  it("lets users upload only into their own folder", async () => {
    const a = await createUser("A");
    const b = await createUser("B");
    const own = await a.client.storage.from("quiz-media").upload(`${a.id}/own.png`, png, { contentType: "image/png" });
    expect(own.error).toBeNull();
    const foreign = await a.client.storage.from("quiz-media").upload(`${b.id}/evil.png`, png, { contentType: "image/png" });
    expect(foreign.error).not.toBeNull();
    const removeForeign = await b.client.storage.from("quiz-media").remove([`${a.id}/own.png`]);
    expect(removeForeign.data ?? []).toHaveLength(0);
  });

  it("rejects disallowed file types at the bucket level", async () => {
    const a = await createUser("C");
    const res = await a.client.storage.from("quiz-media").upload(`${a.id}/x.html`, new Blob(["<script>"]), { contentType: "text/html" });
    expect(res.error).not.toBeNull();
  });
});

describe("media cleanup", () => {
  it("deletes only old, unreferenced uploads", async () => {
    const user = await createUser("Mediji");
    const admin = getAdminSupabase();
    const used = `${user.id}/used.png`;
    const orphan = `${user.id}/orphan.png`;
    const fresh = `${user.id}/fresh.png`;
    for (const path of [used, orphan, fresh]) {
      await admin.storage.from("quiz-media").upload(path, png, { contentType: "image/png" });
    }
    const old = new Date(Date.now() - 2 * 3600_000).toISOString();
    const inserted = await admin.from("quiz_media").insert([
      { owner_id: user.id, path: used, mime_type: "image/png", size_bytes: 8, created_at: old },
      { owner_id: user.id, path: orphan, mime_type: "image/png", size_bytes: 8, created_at: old },
      { owner_id: user.id, path: fresh, mime_type: "image/png", size_bytes: 8, created_at: new Date().toISOString() },
    ]);
    expect(inserted.error).toBeNull();
    const q = f.pinImage();
    q.config.image = { path: used, width: 10, height: 10 };
    await createQuiz(user.client, user.id, { title: "M", description: "", coverImage: null, category: null, tags: [], questions: [q] });

    expect(await cleanupOrphanMedia(user.id)).toBe(1);
    const { data } = await admin.from("quiz_media").select("path").eq("owner_id", user.id);
    expect(data?.map((d) => d.path).sort()).toEqual([fresh, used].sort());
    const list = await admin.storage.from("quiz-media").list(user.id);
    expect(list.data?.map((o) => o.name).sort()).toEqual(["fresh.png", "used.png"]);
  });
});

describe("retention job", () => {
  it("cancels abandoned lobbies and finishes stale games, leaving active ones alone", async () => {
    const admin = getAdminSupabase();
    const host = await createUser("Stari");
    const quizId = await createQuiz(host.client, host.id, { title: "R", description: "", coverImage: null, category: null, tags: [], questions: [f.trueFalse()] });
    const lobby = await createGame(host.id, { quizId, mode: "classic", settings: {} });
    const running = await createGame(host.id, { quizId, mode: "classic", settings: {} });
    const fresh = await createGame(host.id, { quizId, mode: "classic", settings: {} });
    await joinGame(running.sessionId, { nickname: "Igrač" });
    await performAction(running.sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: null });

    // updated_at is maintained by a trigger, so age the rows directly in Postgres.
    sql(
      `alter table public.game_sessions disable trigger game_sessions_updated_at;
       update public.game_sessions set updated_at = now() - interval '7 hours' where id in ('${lobby.sessionId}', '${running.sessionId}');
       alter table public.game_sessions enable trigger game_sessions_updated_at;`,
    );
    const { error } = await admin.rpc("cleanup_stale_games");
    expect(error).toBeNull();
    const states = async (id: string) => (await admin.from("game_sessions").select("state").eq("id", id).single()).data?.state;
    expect(await states(lobby.sessionId)).toBe("cancelled");
    expect(await states(running.sessionId)).toBe("finished");
    expect(await states(fresh.sessionId)).toBe("lobby");
  });
});
