import { test } from "@playwright/test";
import { createQuestion } from "../../src/lib/domain/question-defaults";
import type { Question } from "../../src/lib/domain/schema";
import { joinAsPlayer, newPlayerPage, signUpHost, uploadImage } from "./helpers";

const OUT = process.env.QA_OUT ?? "test-results/qa";

test("visual QA screenshots", async ({ page: host, browser }) => {
  test.setTimeout(240_000);
  await host.setViewportSize({ width: 1440, height: 900 });
  await signUpHost(host, "Snimatelj");
  const map = await uploadImage(host.request, 1000, 560, [40, 120, 160]);
  const qs: Question[] = [];
  const s = createQuestion("single_choice");
  s.title = "Koji je najviši vrh Hrvatske?";
  ["Dinara", "Velebit", "Biokovo", "Učka"].forEach((t, i) => (s.config.options[i]!.text = t));
  s.config.correctOptionId = s.config.options[0]!.id;
  s.explanation = "Sinjal na Dinari visok je 1831 m.";
  qs.push(s);
  const sl = createQuestion("slider");
  sl.title = "Koliko je visok Sinjal (m)?";
  sl.config = { ...sl.config, min: 0, max: 3000, step: 1, target: 1831, tolerance: 100, unit: "m" };
  qs.push(sl);
  const m = createQuestion("matching");
  m.title = "Spoji državu i glavni grad";
  [["Francuska", "Pariz"], ["Italija", "Rim"], ["Mađarska", "Budimpešta"]].forEach(([l, r], i) => {
    m.config.pairs[i]!.left = l!;
    m.config.pairs[i]!.right = r!;
  });
  qs.push(m);
  const pin = createQuestion("pin_image");
  pin.title = "Gdje je središte?";
  pin.config.image = map;
  pin.config.target = { x: 0.62, y: 0.4 };
  qs.push(pin);
  const o = createQuestion("ordering");
  o.title = "Poredaj od najstarijeg";
  ["Kotač", "Tiskarski stroj", "Parni stroj", "Internet"].forEach((t, i) => (o.config.items[i]!.text = t));
  qs.push(o);

  const res = await host.request.post("/api/quizzes", { data: { import: { format: "pitalica-quiz", version: 1, quiz: { title: "Večer kviza", description: "", coverImage: null, category: "Zabava", tags: [], questions: qs } } } });
  const { id: quizId } = await res.json();
  const g = await (await host.request.post("/api/games", { data: { quizId, mode: "classic", settings: {} } })).json();
  await host.goto(`/host/${g.sessionId}`);
  const players = [];
  for (const name of ["Maja", "Luka", "Teta Vesna", "Đuro"]) {
    const p = await newPlayerPage(browser);
    await joinAsPlayer(p.page, g.pin, name);
    players.push(p);
  }
  await host.waitForTimeout(1500);
  await host.screenshot({ path: `${OUT}/host-lobby.png` });
  await players[0]!.page.screenshot({ path: `${OUT}/player-lobby.png` });
  await host.getByRole("button", { name: "Započni igru" }).click();
  await host.waitForTimeout(1200);
  await host.screenshot({ path: `${OUT}/host-leadin.png` });
  await host.waitForTimeout(2600);
  await host.screenshot({ path: `${OUT}/host-question.png` });
  await players[0]!.page.screenshot({ path: `${OUT}/player-q1.png` });
  for (const [i, p] of players.entries()) await p.page.getByRole("button", { name: ["Dinara", "Velebit", "Dinara", "Učka"][i] }).click();
  await host.waitForTimeout(1500);
  await host.screenshot({ path: `${OUT}/host-reveal.png` });
  await players[0]!.page.screenshot({ path: `${OUT}/player-reveal.png` });
  await host.getByRole("button", { name: "Poredak" }).click();
  await host.waitForTimeout(1500);
  await host.screenshot({ path: `${OUT}/host-leaderboard.png` });
  await players[1]!.page.screenshot({ path: `${OUT}/player-leaderboard.png` });
  // slider
  await host.getByRole("button", { name: "Sljedeće pitanje" }).click();
  await players[0]!.page.waitForTimeout(3800);
  await players[0]!.page.screenshot({ path: `${OUT}/player-slider.png` });
  for (const p of players) await p.page.getByRole("button", { name: "Pošalji odgovor" }).click();
  await host.waitForTimeout(1500);
  await host.screenshot({ path: `${OUT}/host-reveal-slider.png` });
  await host.getByRole("button", { name: "Poredak" }).click();
  await host.getByRole("button", { name: "Sljedeće pitanje" }).click();
  // matching
  await players[0]!.page.waitForTimeout(3800);
  await players[0]!.page.getByRole("button", { name: "Francuska", exact: true }).click();
  await players[0]!.page.getByRole("button", { name: "Pariz", exact: true }).click();
  await players[0]!.page.getByRole("button", { name: "Italija", exact: true }).click();
  await players[0]!.page.screenshot({ path: `${OUT}/player-matching.png` });
  await host.screenshot({ path: `${OUT}/host-matching.png` });
  await host.getByRole("button", { name: "Završi pitanje" }).click();
  await host.getByRole("button", { name: "Poredak" }).click();
  await host.getByRole("button", { name: "Sljedeće pitanje" }).click();
  // pin
  await players[0]!.page.waitForTimeout(3800);
  const canvas = players[0]!.page.getByRole("application");
  const box = (await canvas.boundingBox())!;
  await players[0]!.page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.42);
  await players[0]!.page.screenshot({ path: `${OUT}/player-pin.png` });
  for (const p of players) {
    const c = p.page.getByRole("application");
    const b = (await c.boundingBox())!;
    await p.page.mouse.click(b.x + b.width * Math.random(), b.y + b.height * Math.random());
    await p.page.getByRole("button", { name: "Pošalji odgovor" }).click();
  }
  await host.waitForTimeout(1500);
  await host.screenshot({ path: `${OUT}/host-reveal-pin.png` });
  await host.getByRole("button", { name: "Poredak" }).click();
  await host.getByRole("button", { name: "Sljedeće pitanje" }).click();
  await players[0]!.page.waitForTimeout(3800);
  await players[0]!.page.screenshot({ path: `${OUT}/player-ordering.png` });
  await host.getByRole("button", { name: "Završi pitanje" }).click();
  await host.getByRole("button", { name: "Konačni poredak" }).click();
  await host.waitForTimeout(3500);
  await host.screenshot({ path: `${OUT}/host-final.png`, fullPage: true });
  // Editor on phone and tablet.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await host.context().storageState() });
  const pp = await phone.newPage();
  await pp.goto(`/quizzes/${quizId}/edit`);
  await pp.waitForTimeout(2000);
  await pp.screenshot({ path: `${OUT}/editor-phone.png`, fullPage: true });
  await pp.setViewportSize({ width: 820, height: 1180 });
  await pp.goto(`/dashboard`);
  await pp.waitForTimeout(1500);
  await pp.screenshot({ path: `${OUT}/dashboard-tablet.png` });
  await host.goto(`/quizzes/${quizId}/edit`);
  await host.waitForTimeout(1500);
  await host.screenshot({ path: `${OUT}/editor-desktop.png` });
});
