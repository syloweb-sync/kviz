import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createQuestion } from "../../src/lib/domain/question-defaults";
import type { Question } from "../../src/lib/domain/schema";
import { joinAsPlayer, makePng, newPlayerPage, readPin, signUpHost } from "./helpers";

function quiz(questions: Question[], title = "Testni kviz") {
  return { format: "pitalica-quiz", version: 1, quiz: { title, description: "", coverImage: null, category: null, tags: [], questions } };
}

function trueFalse(title: string, correct = true) {
  const q = createQuestion("true_false");
  q.title = title;
  q.config.correct = correct;
  return q;
}

async function importQuiz(page: Page, questions: Question[], title?: string) {
  const res = await page.request.post("/api/quizzes", { data: { import: quiz(questions, title) } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function createGame(page: Page, quizId: string, mode: string, settings: Record<string, unknown> = {}) {
  const res = await page.request.post("/api/games", { data: { quizId, mode, settings } });
  expect(res.status()).toBe(201);
  return (await res.json()) as { sessionId: string; pin: string };
}

test("protected pages redirect to login and bad PINs are rejected", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.goto("/join");
  await page.getByLabel("PIN igre").fill("123456");
  await page.getByRole("button", { name: "Dalje" }).click();
  await expect(page.getByText(/ne postoji ili je završila|Previše pokušaja/)).toBeVisible();
});

test("players reconnect after a reload, and cannot read host data or control the game", async ({ page: host, browser }) => {
  await signUpHost(host);
  const quizId = await importQuiz(host, [trueFalse("Nebo je plavo."), trueFalse("Snijeg je crn.", false)]);
  const { sessionId, pin } = await createGame(host, quizId, "classic");
  await host.goto(`/host/${sessionId}`);

  const a = await newPlayerPage(browser);
  const b = await newPlayerPage(browser);
  await joinAsPlayer(a.page, pin, "Ponovni");
  await joinAsPlayer(b.page, pin, "Drugi");
  await host.getByRole("button", { name: "Započni igru" }).click();

  await a.page.getByRole("button", { name: "Točno", exact: true }).click();
  await expect(a.page.getByText("Odgovor je zaprimljen!")).toBeVisible();

  // Reload: the token in localStorage restores the same player and their submitted answer.
  await a.page.reload();
  await expect(a.page.getByText("Odgovor je zaprimljen!")).toBeVisible();
  await expect(a.page.getByText("Ponovni", { exact: true })).toBeVisible();

  // A stranger on the same game URL is not a participant.
  const stranger = await newPlayerPage(browser);
  await stranger.page.goto(`/play/${sessionId}`);
  await expect(stranger.page.getByRole("heading", { name: "Nisi u ovoj igri" })).toBeVisible();

  // Players' credentials don't grant host access.
  const token = await a.page.evaluate((id) => JSON.parse(localStorage.getItem(`pitalica:player:${id}`) ?? "{}").token as string, sessionId);
  const hostState = await stranger.page.request.get(`/api/games/${sessionId}/state`);
  expect(hostState.status()).toBe(401);
  const control = await stranger.page.request.post(`/api/games/${sessionId}/actions`, {
    data: { action: "close_question", expectedVersion: null },
    headers: { "x-player-token": token },
  });
  expect(control.status()).toBe(403);
  // Re-submitting the same question is rejected.
  const dup = await stranger.page.request.post(`/api/games/${sessionId}/answers`, {
    data: { questionIndex: 0, answer: { value: true } },
    headers: { "x-player-token": token },
  });
  expect(dup.status()).toBe(409);

  // The player view never contains the correct answer while the question is open.
  const playerState = await stranger.page.request.get(`/api/games/${sessionId}/state`, { headers: { "x-player-token": token } });
  const view = (await playerState.json()) as { reveal: unknown; session: { state: string } };
  expect(view.session.state).toBe("question_active");
  expect(view.reveal).toBeNull();

  await b.page.getByRole("button", { name: "Netočno" }).click();
  await expect(a.page.getByText("Točno!")).toBeVisible();
  await expect(host.getByText("odgovora").first()).toBeVisible();

  for (const p of [a, b, stranger]) await p.context.close();
});

test("host-controlled mode with manual review of a typed answer", async ({ page: host, browser }) => {
  await signUpHost(host);
  const q = createQuestion("short_answer");
  q.title = "Kako se zove naš pas?";
  q.config.acceptedAnswers = ["Žućko"];
  q.config.manualReview = true;
  const quizId = await importQuiz(host, [q]);
  const { sessionId, pin } = await createGame(host, quizId, "host_controlled", { speedBonus: false });
  await host.goto(`/host/${sessionId}`);

  const p = await newPlayerPage(browser);
  await joinAsPlayer(p.page, pin, "Pisac");
  await host.getByRole("button", { name: "Započni igru" }).click();
  await p.page.getByLabel("Vaš odgovor").fill("Zuco");
  await p.page.getByRole("button", { name: "Pošalji odgovor" }).click();
  await expect(p.page.getByText("Odgovor je zaprimljen!")).toBeVisible();

  // Nothing closes automatically in host-controlled mode.
  await host.getByRole("button", { name: "Otkrij odgovor" }).click();
  await expect(p.page.getByText("Domaćin pregledava odgovor")).toBeVisible();
  await expect(host.getByText("„Zuco”")).toBeVisible();
  await host.getByRole("button", { name: "Prihvati odgovor igrača Pisac" }).click();
  await expect(p.page.getByText("Točno!")).toBeVisible();
  await expect(p.page.getByText("+ 1.000 bodova")).toBeVisible();
  await p.context.close();
});

test("team mode: players pick teams and the team leaderboard is shown", async ({ page: host, browser }) => {
  await signUpHost(host);
  const quizId = await importQuiz(host, [trueFalse("Voda vrije na 100 °C.")]);
  const { sessionId, pin } = await createGame(host, quizId, "team", { teamNames: ["Plavi", "Crveni"], speedBonus: false });
  await host.goto(`/host/${sessionId}`);

  const players = [];
  for (const [name, team] of [["P1", "Plavi"], ["P2", "Plavi"], ["C1", "Crveni"]] as const) {
    const p = await newPlayerPage(browser);
    await joinAsPlayer(p.page, pin, name, team);
    players.push(p);
  }
  await expect(host.getByText("Plavi · 2")).toBeVisible();
  await host.getByRole("button", { name: "Započni igru" }).click();
  await players[0]!.page.getByRole("button", { name: "Točno", exact: true }).click();
  await players[1]!.page.getByRole("button", { name: "Netočno" }).click();
  await players[2]!.page.getByRole("button", { name: "Točno", exact: true }).click();
  await host.getByRole("button", { name: "Konačni poredak" }).click();
  const teams = host.getByRole("list", { name: "Poredak timova" });
  await expect(teams).toContainText("Crveni");
  await expect(teams.getByRole("listitem").first()).toContainText("1.000");
  await expect(teams.getByRole("listitem").nth(1)).toContainText("500");
  for (const p of players) await p.context.close();
});

test("practice mode runs without a host", async ({ page }) => {
  await signUpHost(page, "Vježbač");
  const quizId = await importQuiz(page, [trueFalse("Zemlja je okrugla.")], "Vježba");
  await page.goto(`/practice/${quizId}`);
  await page.getByRole("button", { name: "Kreni" }).click();
  await page.getByRole("button", { name: "Točno", exact: true }).click();
  await expect(page.getByText("Točno!")).toBeVisible();
  await page.getByRole("button", { name: "Pogledaj rezultat" }).click();
  await expect(page.getByText("Vježba završena!")).toBeVisible();
});

test("editor: image upload, duplicate, delete, reorder, preview and JSON export/import", async ({ page }) => {
  await signUpHost(page);
  await page.getByRole("button", { name: "Novi kviz" }).click();
  await page.waitForURL("**/edit");
  const details = page.getByRole("dialog", { name: "Podaci o kvizu" });
  await details.getByRole("textbox", { name: "Naslov", exact: true }).fill("Uređivač test");
  await details.getByRole("button", { name: "Gotovo" }).click();

  // Pin-on-image question with a real upload.
  await page.getByRole("button", { name: "Dodaj pitanje" }).first().click();
  await page.getByRole("button", { name: /Pribadača na slici/ }).click();
  await page.getByRole("textbox", { name: "Pitanje", exact: true }).fill("Gdje je središte?");
  await page.getByLabel("Slika za pribadaču").setInputFiles({ name: "karta.png", mimeType: "image/png", buffer: makePng(400, 200, [30, 140, 120]) });
  const canvas = page.getByRole("application");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/Točno mjesto: 50 % širine/)).toBeVisible();

  // A second question, duplicated, then the copy deleted.
  await page.getByRole("button", { name: "Dodaj pitanje" }).first().click();
  await page.getByRole("button", { name: /Točno \/ netočno/ }).click();
  await page.getByRole("textbox", { name: "Tvrdnja" }).fill("Ovo je tvrdnja.");
  await page.getByRole("radio", { name: "Netočno" }).click();
  await page.getByRole("button", { name: "Dupliciraj pitanje" }).click();
  await expect(page.getByRole("button", { name: /Ovo je tvrdnja/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Obriši pitanje" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Obriši" }).click();
  await expect(page.getByRole("button", { name: /Ovo je tvrdnja/ })).toHaveCount(1);

  // Keyboard-accessible reorder: move question 2 up.
  await page.getByRole("button", { name: "Pomakni pitanje 2 gore" }).click();
  await expect(page.getByRole("button", { name: /^1\. Točno \/ netočno/ })).toBeVisible();

  // Preview of the selected question, graded locally.
  await page.getByRole("tab", { name: "Pregled" }).click();
  await page.getByRole("button", { name: "Netočno", exact: true }).click();
  await expect(page.getByText("Točno!")).toBeVisible();
  await page.getByRole("tab", { name: "Uredi" }).click();

  await expect(page.getByRole("status").filter({ hasText: /spremljeno/i })).toBeVisible({ timeout: 20_000 });

  // Export → re-import as a new quiz.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Izvoz/ }).click();
  const file = await (await download).path();
  const exported = JSON.parse(readFileSync(file, "utf8")) as { format: string; quiz: { questions: unknown[] } };
  expect(exported.format).toBe("pitalica-quiz");
  expect(exported.quiz.questions).toHaveLength(2);

  await page.goto("/dashboard");
  await page.getByLabel("Odaberi JSON datoteku kviza").setInputFiles({ name: "kviz.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForURL("**/edit");
  await expect(page.getByRole("button", { name: /Gdje je središte/ })).toBeVisible();

  // The imported quiz is immediately playable; start it to see the lobby PIN.
  await page.getByRole("button", { name: /Pokreni igru/ }).click();
  await page.getByRole("button", { name: "Otvori predvorje i PIN" }).click();
  await readPin(page);
});

test("dashboard search, duplicate and delete", async ({ page }) => {
  await signUpHost(page);
  await importQuiz(page, [trueFalse("A")], "Povijest Rima");
  await importQuiz(page, [trueFalse("B")], "Zemljopis Europe");
  await page.goto("/dashboard");
  await page.getByLabel("Pretraži kvizove").fill("rim");
  await expect(page.getByRole("heading", { name: "Povijest Rima" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zemljopis Europe" })).toHaveCount(0);
  await page.getByLabel("Pretraži kvizove").fill("");

  await page.getByRole("button", { name: "Više radnji za Povijest Rima" }).click();
  await page.getByRole("menuitem", { name: "Dupliciraj" }).click();
  await expect(page.getByRole("heading", { name: "Povijest Rima (kopija)" })).toBeVisible();

  await page.getByRole("button", { name: "Više radnji za Povijest Rima (kopija)" }).click();
  await page.getByRole("menuitem", { name: "Obriši" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Obriši kviz" }).click();
  await expect(page.getByRole("heading", { name: "Povijest Rima (kopija)" })).toHaveCount(0);
});
