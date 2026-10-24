import { expect, test } from "@playwright/test";
import { signUpHost } from "./helpers";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

async function latestLinkFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const data = (await res.json()) as { messages?: { ID: string }[] };
    const id = data.messages?.[0]?.ID;
    if (id) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML?: string; Text?: string };
      const body = `${message.HTML ?? ""} ${message.Text ?? ""}`;
      const match = body.match(/https?:\/\/[^\s"'<>]+verify[^\s"'<>]+/);
      if (match) return match[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Reset e-mail did not arrive");
}

test("sign out, wrong password, password reset by e-mail, sign in with the new password", async ({ page }) => {
  const email = await signUpHost(page, "Zaboravna");

  // Sign out from the account menu.
  await page.getByRole("button", { name: "Izbornik računa" }).click();
  await page.getByRole("menuitem", { name: "Odjava" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  // Wrong password shows a friendly error.
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Lozinka").fill("pogresna-lozinka");
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Pogrešan e-mail ili lozinka." })).toBeVisible();

  // Request a reset link and follow it from the e-mail.
  await page.getByRole("link", { name: "Zaboravili ste lozinku?" }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Pošalji poveznicu" }).click();
  await expect(page.getByText("Poveznica je poslana")).toBeVisible();
  await page.goto(await latestLinkFor(email));
  await page.waitForURL("**/reset-password");
  await page.getByLabel("Nova lozinka").fill("nova-lozinka-456");
  await page.getByLabel("Ponovite lozinku").fill("nova-lozinka-456");
  await page.getByRole("button", { name: "Spremi lozinku" }).click();
  await page.waitForURL("**/dashboard");

  // The new password works after signing out.
  await page.getByRole("button", { name: "Izbornik računa" }).click();
  await page.getByRole("menuitem", { name: "Odjava" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto("/login?next=/dashboard/games");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Lozinka").fill("nova-lozinka-456");
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await page.waitForURL("**/dashboard/games");
});
