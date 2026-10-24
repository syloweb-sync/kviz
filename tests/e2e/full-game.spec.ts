import { expect, test } from "@playwright/test";
import { joinAsPlayer, newPlayerPage, readPin, signUpHost } from "./helpers";

test("host builds a quiz in the editor and plays it live with two players", async ({ page: host, browser }) => {
  // 1. Host signs up and creates a quiz through the editor UI.
  await signUpHost(host, "Vesna");
  await host.getByRole("button", { name: "Novi kviz" }).click();
  await host.waitForURL("**/edit");
  const details = host.getByRole("dialog", { name: "Podaci o kvizu" });
  await details.getByRole("textbox", { name: "Naslov", exact: true }).fill("E2E obiteljski kviz");
  await details.getByRole("combobox", { name: "Kategorija" }).fill("Obitelj");
  await details.getByRole("button", { name: "Gotovo" }).click();

  // Question 1: single choice
  await host.getByRole("button", { name: "Dodaj pitanje" }).first().click();
  await host.getByRole("button", { name: /Jedan točan odgovor/ }).click();
  await host.getByRole("textbox", { name: "Pitanje", exact: true }).fill("Koji je glavni grad Australije?");
  for (const [i, text] of ["Sydney", "Canberra", "Melbourne", "Perth"].entries()) {
    await host.getByRole("textbox", { name: `Odgovor ${i + 1}`, exact: true }).fill(text);
  }
  await host.getByRole("radio", { name: "Odgovor 2 je točan" }).click();

  // Question 2: true / false
  await host.getByRole("button", { name: "Dodaj pitanje" }).first().click();
  await host.getByRole("button", { name: /Točno \/ netočno/ }).click();
  await host.getByRole("textbox", { name: "Tvrdnja" }).fill("Dubrovnik je na moru.");
  await host.getByRole("radio", { name: "Točno", exact: true }).click();

  // Question 3: short answer
  await host.getByRole("button", { name: "Dodaj pitanje" }).first().click();
  await host.getByRole("button", { name: /Kratki odgovor/ }).click();
  await host.getByRole("textbox", { name: "Pitanje", exact: true }).fill("Najduža rijeka u Hrvatskoj?");
  await host.getByLabel("Prihvatljiv odgovor 1").fill("Sava");

  await expect(host.getByRole("status").filter({ hasText: /spremljeno/i })).toBeVisible({ timeout: 20_000 });

  // The quiz persists: reload and check the question list.
  await host.reload();
  await expect(host.getByRole("button", { name: /Najduža rijeka/ })).toBeVisible();

  // 2. Start a game.
  await host.getByRole("button", { name: /Pokreni igru/ }).click();
  await host.waitForURL("**/host");
  await host.getByRole("button", { name: "Otvori predvorje i PIN" }).click();
  await host.waitForURL(/\/host\/[0-9a-f-]+$/);
  const pin = await readPin(host);

  // 3. Two players join from phones.
  const ana = await newPlayerPage(browser);
  const ivo = await newPlayerPage(browser);
  await joinAsPlayer(ana.page, pin, "Ana");
  await joinAsPlayer(ivo.page, pin, "Ivo");
  await expect(host.getByText("2 igrača")).toBeVisible();
  await expect(host.getByText("Ana", { exact: true })).toBeVisible();

  // 4. Play.
  await host.getByRole("button", { name: "Započni igru" }).click();

  // Q1 — Ana correct, Ivo wrong.
  await ana.page.getByRole("button", { name: "Canberra" }).click();
  await expect(ana.page.getByText("Odgovor je zaprimljen!")).toBeVisible();
  await ivo.page.getByRole("button", { name: "Sydney" }).click();
  await expect(ana.page.getByText("Točno!")).toBeVisible();
  await expect(ivo.page.getByText("Netočno", { exact: true })).toBeVisible();
  await expect(host.getByText("odgovora").first()).toBeVisible();
  await host.getByRole("button", { name: "Poredak" }).click();
  await expect(host.getByRole("heading", { name: "Poredak" })).toBeVisible();
  await expect(ana.page.getByText("Tvoj poredak")).toBeVisible();
  await host.getByRole("button", { name: "Sljedeće pitanje" }).click();

  // Q2 — both correct.
  await ana.page.getByRole("button", { name: "Točno", exact: true }).click();
  await ivo.page.getByRole("button", { name: "Točno", exact: true }).click();
  await expect(ivo.page.getByText("Točno!")).toBeVisible();
  await host.getByRole("button", { name: "Poredak" }).click();
  await host.getByRole("button", { name: "Sljedeće pitanje" }).click();

  // Q3 — short answer, accent/case-insensitive.
  await ana.page.getByLabel("Vaš odgovor").fill("  SAVA ");
  await ana.page.getByRole("button", { name: "Pošalji odgovor" }).click();
  await ivo.page.getByLabel("Vaš odgovor").fill("Drava");
  await ivo.page.getByRole("button", { name: "Pošalji odgovor" }).click();
  await expect(ana.page.getByText("Točno!")).toBeVisible();
  await host.getByRole("button", { name: "Konačni poredak" }).click();

  // 5. Final leaderboard everywhere.
  await expect(host.getByText(/Pobjednik:/)).toBeVisible();
  await expect(host.getByRole("table")).toContainText("Ana");
  await expect(ana.page.getByText("1. mjesto", { exact: true })).toBeVisible();
  await expect(ivo.page.getByText("2. mjesto", { exact: true })).toBeVisible();

  // 6. Results are saved and visible in the dashboard history.
  await host.getByRole("link", { name: "Detaljni rezultati" }).click();
  await expect(host.getByRole("heading", { name: "E2E obiteljski kviz" })).toBeVisible();
  await expect(host.getByText("Koji je glavni grad Australije?")).toBeVisible();

  await ana.context.close();
  await ivo.context.close();
});
