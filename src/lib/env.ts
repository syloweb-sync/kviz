/**
 * Typed access to configuration. Public values are inlined at build time by Next.js, so they
 * must be referenced with their full literal names.
 */

export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { supabaseUrl: url ?? "", supabaseKey: key ?? "", configured: Boolean(url && key) };
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function requirePublicEnv() {
  const env = publicEnv();
  if (!env.configured) {
    throw new ConfigurationError(
      "Supabase nije konfiguriran. Postavite NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (vidi README).",
    );
  }
  return env;
}
