import { existsSync } from "node:fs";

// Integration tests run against the local Supabase stack (`npm run db:start`).
for (const file of [".env.test.local", ".env.local"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error("Integration tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see README → Testing).");
}
