import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { handler, json, notFound } from "@/lib/server/http";
import { getServerSupabase } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_request: Request, ctx: Ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound("Kviz ne postoji.");
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("duplicate_quiz", { p_quiz_id: id });
  if (error) {
    if (error.code === "P0002") throw notFound("Kviz ne postoji.");
    throw error;
  }
  return json({ id: data }, { status: 201 });
});
