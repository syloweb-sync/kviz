import type { ValidationIssue } from "@/lib/domain/validation";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** JSON fetch wrapper that turns API error envelopes into `ApiClientError`. */
export async function apiFetch<T>(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: { ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiClientError(0, "network", "Nema veze s poslužiteljem. Provjerite internet.");
  }
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: { code: string; message: string; issues?: ValidationIssue[] } })
    | null;
  if (!response.ok) {
    const err = data?.error;
    throw new ApiClientError(
      response.status,
      err?.code ?? "unknown",
      err?.message ?? "Nešto je pošlo po zlu.",
      Array.isArray(err?.issues) ? err.issues : [],
    );
  }
  return data as T;
}
