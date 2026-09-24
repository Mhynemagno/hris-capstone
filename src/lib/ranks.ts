import type { Rank } from "@/lib/types/database";

/** How a rank is shown everywhere in the app, e.g. "Pat — Patrolman / Patrolwoman". */
export function rankLabel(rank: Pick<Rank, "code" | "name">) {
  return `${rank.code} — ${rank.name}`;
}
