"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

let browserClient: SupabaseClient<Database> | null = null;

/** Singleton browser client (publishable key only — RLS protects all data). */
export function getBrowserSupabase(): SupabaseClient<Database> {
  if (!browserClient) {
    const { supabaseUrl, supabaseKey } = requirePublicEnv();
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseKey);
  }
  return browserClient;
}
