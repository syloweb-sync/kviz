import { z } from "zod";
import { ApiError, clientIp, handler, json, readJson, tooManyRequests } from "@/lib/server/http";
import { lookupPin } from "@/lib/server/games/service";
import { enforceRateLimit, isRateLimited } from "@/lib/server/rate-limit";

const MISS_LIMIT = 12;
const MISS_WINDOW_SECONDS = 60;

/**
 * PIN lookup. Only *failed* lookups count against the per-IP limit, so a whole classroom
 * behind one NAT can join, while guessing the 900 000-PIN space stays impractical
 * (12 wrong guesses per minute per address).
 */
export const POST = handler(async (request: Request) => {
  const ip = clientIp(request);
  if (await isRateLimited("pin-miss", ip, MISS_LIMIT, MISS_WINDOW_SECONDS)) throw tooManyRequests();
  await enforceRateLimit("pin", ip, 240, 60);
  const { pin } = z.object({ pin: z.string().trim().max(12) }).parse(await readJson(request));
  try {
    return json(await lookupPin(pin.replace(/\s/g, "")));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      await enforceRateLimit("pin-miss", ip, MISS_LIMIT, MISS_WINDOW_SECONDS);
    }
    throw error;
  }
});
