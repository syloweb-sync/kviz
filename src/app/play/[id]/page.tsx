import type { Metadata } from "next";
import { PlayerGame } from "@/components/player/player-game";

export const metadata: Metadata = { title: "Igra" };

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerGame sessionId={id} />;
}
