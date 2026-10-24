import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConfigurationError } from "@/lib/env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, code = "bad_request") => new ApiError(400, code, message);
export const unauthorized = (message = "Prijavite se za nastavak.") => new ApiError(401, "unauthorized", message);
export const forbidden = (message = "Nemate ovlasti za ovu radnju.") => new ApiError(403, "forbidden", message);
export const notFound = (message = "Nije pronađeno.") => new ApiError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") => new ApiError(409, code, message);
export const tooManyRequests = (message = "Previše pokušaja. Pričekajte trenutak.") =>
  new ApiError(429, "rate_limited", message);

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return json(
      { error: { code: "validation", message: "Neispravni podaci.", issues: error.issues.slice(0, 10) } },
      { status: 400 },
    );
  }
  if (error instanceof ConfigurationError) {
    return json({ error: { code: "not_configured", message: error.message } }, { status: 503 });
  }
  console.error("[api] unexpected error", error);
  return json({ error: { code: "internal", message: "Nešto je pošlo po zlu. Pokušajte ponovno." } }, { status: 500 });
}

/** Wraps a route handler so every thrown error becomes a consistent JSON response. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 1_000_000) throw badRequest("Zahtjev je prevelik.");
  try {
    return await request.json();
  } catch {
    throw badRequest("Neispravan JSON.");
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
