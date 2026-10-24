import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ConfigurationError, requirePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

export type TypedClient = SupabaseClient<Database>;

/** Request-scoped client acting as the signed-in user (RLS applies). */
export async function getServerSupabase(): Promise<TypedClient> {
  const { supabaseUrl, supabaseKey } = requirePublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by the proxy instead.
        }
      },
    },
  });
}

export function secretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new ConfigurationError("Nedostaje SUPABASE_SECRET_KEY (serverska varijabla, vidi README).");
  }
  return key;
}

let adminClient: TypedClient | null = null;

/**
 * Privileged client for authoritative game operations. Bypasses RLS — only ever used inside
 * route handlers after the caller has been authorised. Never import this from client code
 * (`server-only` makes that a build error).
 */
export function getAdminSupabase(): TypedClient {
  if (!adminClient) {
    const { supabaseUrl } = requirePublicEnv();
    adminClient = createClient<Database>(supabaseUrl, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}
