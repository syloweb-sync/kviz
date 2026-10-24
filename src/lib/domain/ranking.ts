/**
 * Leaderboard ordering and tie handling.
 *
 * Players are ordered by: score ↓, correct answers ↓, total response time ↑, join time ↑.
 * Ranks use standard competition ranking on score alone ("1, 1, 3"): players with the same
 * score share a rank, while the secondary keys only make the displayed order deterministic.
 */

export interface RankablePlayer {
  id: string;
  score: number;
  correctCount: number;
  totalResponseMs: number;
  joinedAt: string;
}

export type Ranked<T> = T & { rank: number };

export function comparePlayers(a: RankablePlayer, b: RankablePlayer): number {
  return (
    b.score - a.score ||
    b.correctCount - a.correctCount ||
    a.totalResponseMs - b.totalResponseMs ||
    a.joinedAt.localeCompare(b.joinedAt) ||
    a.id.localeCompare(b.id)
  );
}

export function rankPlayers<T extends RankablePlayer>(players: readonly T[]): Ranked<T>[] {
  const sorted = [...players].sort(comparePlayers);
  let previousScore: number | null = null;
  let previousRank = 0;
  return sorted.map((player, index) => {
    const rank = previousScore !== null && player.score === previousScore ? previousRank : index + 1;
    previousScore = player.score;
    previousRank = rank;
    return { ...player, rank };
  });
}

export interface TeamInput {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface TeamStanding extends TeamInput {
  score: number;
  memberCount: number;
  rank: number;
}

/**
 * Team score = rounded average of member scores, so larger teams have no built-in advantage.
 * Teams without members score 0. Ties share a rank; display order falls back to team position.
 */
export function rankTeams(
  teams: readonly TeamInput[],
  players: readonly { teamId: string | null; score: number }[],
): TeamStanding[] {
  const standings = teams.map((team) => {
    const members = players.filter((p) => p.teamId === team.id);
    const total = members.reduce((sum, p) => sum + p.score, 0);
    return { ...team, memberCount: members.length, score: members.length ? Math.round(total / members.length) : 0 };
  });
  standings.sort((a, b) => b.score - a.score || b.memberCount - a.memberCount || a.position - b.position);
  let previous: number | null = null;
  let previousRank = 0;
  return standings.map((team, index) => {
    const rank = previous !== null && team.score === previous ? previousRank : index + 1;
    previous = team.score;
    previousRank = rank;
    return { ...team, rank };
  });
}
