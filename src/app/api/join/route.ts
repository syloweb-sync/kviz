import { z } from "zod";
import { clientIp, handler, json, readJson } from "@/lib/server/http";
import { lookupPin } from "@/lib/server/games/service";
import { enforceRateLimit } from "@/lib/server/rate-limit";

/** PIN lookup. Rate limited per IP to make brute-forcing the 900 000 PIN space impractical. */
export const POST = handler(async (request: Request) => {
  await enforceRateLimit("pin", clientIp(request), 20, 60);
  const { pin } = z.object({ pin: z.string().trim().max(12) }).parse(await readJson(request));
  return json(await lookupPin(pin.replace(/\s/g, "")));
});
