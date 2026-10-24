import { expect, test, type Page } from "@playwright/test";
import { createQuestion } from "../../src/lib/domain/question-defaults";
import type { Question } from "../../src/lib/domain/schema";
import { joinAsPlayer, newPlayerPage, signUpHost, uploadImage } from "./helpers";

/**
 * Plays one question of every type through the real player UI and checks that the server
 * grades the interaction as correct (or records the vote for polls and rankings).
 */

type Step = { title: string; answer: (player: Page) => Promise<void>; expected: RegExp };

async function buildQuiz(page: Page): Promise<{ questions: Question[]; steps: Step[] }> {
  const red = await uploadImage(page.request, 200, 200, [230, 60, 60]);
  const blue = await uploadImage(page.request, 200, 200, [60, 90, 230]);
  const green = await uploadImage(page.request, 200, 200, [40, 190, 90]);
  const yellow = await uploadImage(page.request, 200, 200, [240, 200, 40]);
  const map = await uploadImage(page.request, 1000, 500, [40, 120, 160]);

  const questions: Question[] = [];
  const steps: Step[] = [];
  const add = (q: Question, step: Omit<Step, "title">) => {
    questions.push(q);
    steps.push({ ...step, title: q.title });
  };

  const single = createQuestion("single_choice");
  single.title = "Glavni grad Australije?";
  ["Sydney", "Canberra", "Melbourne", "Perth"].forEach((t, i) => (single.config.options[i]!.text = t));
  single.config.correctOptionId = single.config.options[1]!.id;
  add(single, { answer: (p) => p.getByRole("button", { name: "Canberra" }).click(), expected: /^Točno!$/ });

  const multi = createQuestion("multi_select");
  multi.title = "Koji su sisavci?";
  ["Dupin", "Morski pas", "Šišmiš", "Pingvin"].forEach((t, i) => (multi.config.options[i]!.text = t));
  multi.config.correctOptionIds = [multi.config.options[0]!.id, multi.config.options[2]!.id];
  add(multi, {
    answer: async (p) => {
      await p.getByRole("checkbox", { name: "Dupin" }).click();
      await p.getByRole("checkbox", { name: "Šišmiš" }).click();
      await p.getByRole("button", { name: "Pošalji odgovor" }).click();
    },
    expected: /^Točno!$/,
  });

  const tf = createQuestion("true_false");
  tf.title = "Dubrovnik je na moru.";
  tf.config.correct = true;
  add(tf, { answer: (p) => p.getByRole("button", { name: "Točno", exact: true }).click(), expected: /^Točno!$/ });

  const slider = createQuestion("slider");
  slider.title = "Koliko je 3 + 4?";
  slider.config = { ...slider.config, min: 0, max: 10, step: 1, target: 7, tolerance: 0 };
  add(slider, {
    answer: async (p) => {
      const thumb = p.getByRole("slider");
      await thumb.focus();
      await thumb.press("ArrowRight");
      await thumb.press("ArrowRight");
      await expect(p.getByText("7", { exact: true }).first()).toBeVisible();
      await p.getByRole("button", { name: "Pošalji odgovor" }).click();
    },
    expected: /^Točno!$/,
  });

  const short = createQuestion("short_answer");
  short.title = "Najduža rijeka u Hrvatskoj?";
  short.config.acceptedAnswers = ["Sava"];
  add(short, {
    answer: async (p) => {
      await p.getByLabel("Vaš odgovor").fill("sava");
      await p.getByRole("button", { name: "Pošalji odgovor" }).click();
    },
    expected: /^Točno!$/,
  });

  const numeric = createQuestion("numeric");
  numeric.title = "Koliko kostiju ima odrasla osoba?";
  numeric.config.target = 206;
  numeric.feedback = "immediate";
  add(numeric, {
    answer: async (p) => {
      await p.getByLabel("Vaš odgovor").fill("206");
      await p.getByRole("button", { name: "Pošalji odgovor" }).click();
    },
    expected: /^Točno!$/,
  });

  const pin = createQuestion("pin_image");
  pin.title = "Dodirni središte slike";
  pin.config.image = map;
  pin.config.target = { x: 0.5, y: 0.5 };
  pin.config.radius = 0.1;
  // Graded distance scoring is covered by unit tests; here any tap inside the circle earns full points.
  pin.config.graded = false;
  add(pin, {
    answer: async (p) => {
      const canvas = p.getByRole("application");
      const box = (await canvas.boundingBox())!;
      await p.mouse.click(box.x + box.width * 0.51, box.y + box.height * 0.5);
      await p.getByRole("button", { name: "Pošalji odgovor" }).click();
    },
    expected: /^Točno!$/,
  });

  const ordering = createQuestion("ordering");
  ordering.title = "Poredaj brojeve uzlazno";
  const orderTexts = ["Jedan", "Dva", "Tri", "Četiri"];
  orderTexts.forEach((t, i) => (ordering.config.items[i]!.text = t));
  add(ordering, {
    answer: async (p) => {
      for (let target = 0; target < orderTexts.length; target++) {
        const labels = await p.getByRole("button", { name: /dolje$/ }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
        const current = labels.map((l) => l.replace(/^Pomakni „/, "").replace(/” dolje$/, ""));
        let index = current.indexOf(orderTexts[target]!);
        while (index > target) {
          await p.getByRole("button", { name: `Pomakni „${orderTexts[target]}” gore` }).click();
          index--;
        }
      }
      await p.getByRole("button", { name: "Pošalji odgovor" }).click();
    },
    expected: /^Točno!$/,
  });

  const matching = createQuestion("matching");
  matching.title = "Spoji državu i glavni grad";
  const pairs: [string, string][] = [
    ["Francuska", "Pariz"],
    ["Italija", "Rim"],
    ["Mađarska", "Budimpešta"],
  ];
  pairs.forEach(([l, r], i) => {
    matching.config.pairs[i]!.left = l;
    matching.config.pairs[i]!.right = r;
  });
  add(matching, {
    answer: async (p) => {
      for (const [l, r] of pairs) {
        await p.getByRole("button", { name: l, exact: true }).click();
        await p.getByRole("button", { name: r, exact: true }).click();
      }
      await p.getByRole("button", { name: "Pošalji odgovor" }).click();
    },
    expected: /^Točno!$/,
  });

  const images = createQuestion("image_choice");
  images.title = "Koja je slika zelena?";
  const captions = ["Crvena", "Plava", "Zelena", "Žuta"];
  [red, blue, green, yellow].forEach((m, i) => {
    images.config.options[i]!.media = m;
    images.config.options[i]!.caption = captions[i]!;
  });
  images.config.correctOptionId = images.config.options[2]!.id;
  add(images, { answer: (p) => p.getByRole("button", { name: "Zelena" }).click(), expected: /^Točno!$/ });

  const poll = createQuestion("poll");
  poll.title = "Kamo na izlet?";
  ["More", "Planina", "Grad"].forEach((t, i) => (poll.config.options[i]!.text = t));
  add(poll, { answer: (p) => p.getByRole("button", { name: "More" }).click(), expected: /^Glas zabilježen$/ });

  const ranking = createQuestion("ranking");
  ranking.title = "Najdraže godišnje doba";
  ["Proljeće", "Ljeto", "Jesen", "Zima"].forEach((t, i) => (ranking.config.options[i]!.text = t));
  add(ranking, { answer: (p) => p.getByRole("button", { name: "Pošalji odgovor" }).click(), expected: /^Glas zabilježen$/ });

  return { questions, steps };
}

test("every question type can be answered correctly through the player UI", async ({ page: host, browser }) => {
  test.setTimeout(240_000);
  await signUpHost(host, "Tester tipova");
  const { questions, steps } = await buildQuiz(host);

  const imported = await host.request.post("/api/quizzes", {
    data: { import: { format: "pitalica-quiz", version: 1, quiz: { title: "Svi tipovi", description: "", coverImage: null, category: null, tags: [], questions } } },
  });
  expect(imported.status()).toBe(201);
  const { id: quizId } = (await imported.json()) as { id: string };

  const created = await host.request.post("/api/games", {
    data: { quizId, mode: "classic", settings: { showLeaderboard: false, speedBonus: false } },
  });
  expect(created.status()).toBe(201);
  const { sessionId, pin } = (await created.json()) as { sessionId: string; pin: string };

  await host.goto(`/host/${sessionId}`);
  const player = await newPlayerPage(browser);
  await joinAsPlayer(player.page, pin, "Tipko");
  await host.getByRole("button", { name: "Započni igru" }).click();

  for (const [index, step] of steps.entries()) {
    await test.step(`${index + 1}. ${questions[index]!.type}`, async () => {
      await expect(player.page.getByRole("heading", { name: step.title })).toBeVisible({ timeout: 20_000 });
      await step.answer(player.page);
      await expect(player.page.getByRole("status").getByText(step.expected)).toBeVisible();
      const last = index === steps.length - 1;
      await host.getByRole("button", { name: last ? "Konačni poredak" : "Sljedeće pitanje" }).click();
    });
  }

  await expect(host.getByText(/Pobjednik:/)).toBeVisible();
  await expect(player.page.getByText("Pobjeda!")).toBeVisible();
  // 10 graded questions, all correct, 1000 points each without speed bonus.
  await expect(player.page.getByText("10.000 bodova")).toBeVisible();
  await player.context.close();
});
