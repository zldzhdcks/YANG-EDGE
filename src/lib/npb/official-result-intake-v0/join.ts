import type { NpbEvidenceGameV0 } from "@/lib/npb/pregame-evidence-snapshot-v0";
import type {
  NpbCollectedOfficialGameV0,
  NpbResultJoinStatus,
} from "./types";

export function teamPairKey(a: string, b: string): string {
  return [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join("|");
}

export type NpbResultJoinHit = {
  joinStatus: NpbResultJoinStatus;
  collected: NpbCollectedOfficialGameV0 | null;
};

/**
 * Join official results to pregame games by unordered team-pair identity.
 * Home/away venue flip between schedule seed and official box is expected.
 */
export function joinCollectedToPregame(
  pregame: NpbEvidenceGameV0,
  collected: NpbCollectedOfficialGameV0[],
): NpbResultJoinHit {
  const key = teamPairKey(pregame.awayTeam, pregame.homeTeam);
  const hits = collected.filter(
    (c) => teamPairKey(c.awayTeam, c.homeTeam) === key,
  );
  if (hits.length === 0) {
    return { joinStatus: "NOT_MATCHED", collected: null };
  }
  if (hits.length > 1) {
    return { joinStatus: "AMBIGUOUS", collected: null };
  }
  return { joinStatus: "MATCHED", collected: hits[0]! };
}

/** Map official venue scores onto pregame snapshot home/away orientation. */
export function mapScoresOntoPregame(
  pregame: Pick<NpbEvidenceGameV0, "awayTeam" | "homeTeam">,
  collected: Pick<
    NpbCollectedOfficialGameV0,
    "awayTeam" | "homeTeam" | "awayScore" | "homeScore"
  >,
): { awayScore: number | null; homeScore: number | null } {
  const scoreByTeam = new Map<string, number | null>();
  scoreByTeam.set(collected.awayTeam, collected.awayScore);
  scoreByTeam.set(collected.homeTeam, collected.homeScore);

  if (
    !scoreByTeam.has(pregame.awayTeam) ||
    !scoreByTeam.has(pregame.homeTeam)
  ) {
    return { awayScore: null, homeScore: null };
  }

  return {
    awayScore: scoreByTeam.get(pregame.awayTeam) ?? null,
    homeScore: scoreByTeam.get(pregame.homeTeam) ?? null,
  };
}
