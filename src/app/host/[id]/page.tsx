import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { HostGame } from "@/components/host/host-game";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Igra uživo" };

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${id}`);
  // RLS: only the host can read their session row.
  const { data } = await supabase.from("game_sessions").select("id, quiz_id, mode").eq("id", id).maybeSingle();
  if (!data || data.mode === "practice") notFound();
  return <HostGame sessionId={id} quizId={data.quiz_id} />;
}
