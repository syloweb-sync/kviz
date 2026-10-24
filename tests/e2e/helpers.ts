import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

export async function signUpHost(page: Page, name = "Domaćin Test") {
  const email = `e2e-${randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Ime ili nadimak").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Lozinka").fill("lozinka-e2e-123");
  await page.getByRole("button", { name: "Otvori račun" }).click();
  await page.waitForURL("**/dashboard");
  return email;
}

export async function newPlayerPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "hr-HR" });
  return { context, page: await context.newPage() };
}

export async function joinAsPlayer(page: Page, pin: string, nickname: string, team?: string) {
  await page.goto(`/join?pin=${pin}`);
  await expect(page.getByLabel("Tvoj nadimak")).toBeVisible();
  await page.getByLabel("Tvoj nadimak").fill(nickname);
  if (team) await page.getByRole("radio", { name: team }).click();
  await page.getByRole("button", { name: "Uđi u igru" }).click();
  await expect(page.getByRole("heading", { name: "Unutra si!" })).toBeVisible();
}

/** Reads the 6-digit PIN from the host lobby. */
export async function readPin(host: Page): Promise<string> {
  const label = await host.getByLabel(/^PIN \d/).first().getAttribute("aria-label");
  const pin = (label ?? "").replace(/\D/g, "");
  expect(pin).toMatch(/^\d{6}$/);
  return pin;
}

/** Minimal valid PNG (solid colour) generated without dependencies. */
export function makePng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3)]);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Uploads an image through the app's signed-upload flow, as the signed-in host. */
export async function uploadImage(request: APIRequestContext, width: number, height: number, rgb: [number, number, number]) {
  const png = makePng(width, height, rgb);
  const res = await request.post("/api/media", { data: { mimeType: "image/png", size: png.length } });
  expect(res.status()).toBe(201);
  const { path, signedUrl } = (await res.json()) as { path: string; signedUrl: string };
  const put = await request.put(signedUrl, {
    data: png,
    headers: { "content-type": "image/png", "x-upsert": "false", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
  });
  expect(put.ok()).toBeTruthy();
  return { path, width, height };
}
