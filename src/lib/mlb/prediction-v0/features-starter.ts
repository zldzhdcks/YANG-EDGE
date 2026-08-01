/**
 * Starter edge feature — ERA/WHIP with sample shrink toward league average.
 */
import {
  MLB_PREDICTION_V0_CALIBRATION as C,
} from "./config";
import { clamp } from "./math";
import type { FeatureProvenance, StarterFeature, StarterQuality } from "./types";

function qualityFromIp(ip: number | null): StarterQuality {
  if (ip == null || ip <= 0) return "INSUFFICIENT";
  if (ip >= C.minInningsForFullTrust) return "GOOD";
  if (ip >= C.minInningsForPartial) return "PARTIAL";
  return "INSUFFICIENT";
}

function shrinkWeight(ip: number | null, quality: StarterQuality): number {
  if (quality === "MISSING" || quality === "INSUFFICIENT") return 0.25;
  if (ip == null) return 0.3;
  if (ip >= C.minInningsForFullTrust) return 1;
  if (ip >= C.minInningsForPartial) {
    return (
      0.45 +
      0.55 *
        ((ip - C.minInningsForPartial) /
          (C.minInningsForFullTrust - C.minInningsForPartial))
    );
  }
  return 0.25 + 0.2 * (ip / C.minInningsForPartial);
}

/**
 * Map pitcher quality to 0–100 score (higher = better for that pitcher's team).
 */
export function starterScoreFromStats(args: {
  era: number | null;
  whip: number | null;
  inningsPitched: number | null;
}): { score: number; quality: StarterQuality } {
  const { era, whip, inningsPitched: ip } = args;
  if (era == null && whip == null) {
    return { score: 50, quality: "MISSING" };
  }
  const quality = qualityFromIp(ip);
  const eraAdj = era ?? C.leagueAvgEra;
  const whipAdj = whip ?? C.leagueAvgWhip;
  const w = shrinkWeight(ip, quality);
  const shrunkEra = C.leagueAvgEra + (eraAdj - C.leagueAvgEra) * w;
  const shrunkWhip = C.leagueAvgWhip + (whipAdj - C.leagueAvgWhip) * w;
  // Better pitcher → lower ERA/WHIP → higher score
  const eraPart = clamp(50 + ((C.leagueAvgEra - shrunkEra) / 2) * 25, 0, 100);
  const whipPart = clamp(50 + ((C.leagueAvgWhip - shrunkWhip) / 0.4) * 25, 0, 100);
  const score = clamp(0.6 * eraPart + 0.4 * whipPart, 0, 100);
  return { score, quality: era == null && whip == null ? "MISSING" : quality };
}

export function buildStarterFeature(args: {
  playerName: string | null;
  era: number | null;
  whip: number | null;
  inningsPitched: number | null;
  strikeouts: number | null;
  walks: number | null;
  throws: "L" | "R" | null;
  provenance: FeatureProvenance;
}): StarterFeature {
  const { score, quality } = starterScoreFromStats({
    era: args.era,
    whip: args.whip,
    inningsPitched: args.inningsPitched,
  });
  const warnings = [...args.provenance.warning];
  if (quality === "MISSING") warnings.push("STARTER_STATS_MISSING");
  if (quality === "INSUFFICIENT") warnings.push("STARTER_SAMPLE_INSUFFICIENT");
  if (quality === "PARTIAL") warnings.push("STARTER_SAMPLE_PARTIAL");
  return {
    playerName: args.playerName,
    era: args.era,
    whip: args.whip,
    inningsPitched: args.inningsPitched,
    strikeouts: args.strikeouts,
    walks: args.walks,
    throws: args.throws,
    score,
    quality: args.playerName ? quality : "MISSING",
    provenance: { ...args.provenance, warning: warnings },
  };
}

/** Home-positive starter edge in roughly [-1, +1]. */
export function starterEdge(
  home: StarterFeature,
  away: StarterFeature,
): number {
  if (home.quality === "MISSING" && away.quality === "MISSING") return 0;
  return clamp((home.score - away.score) / 100, -1, 1);
}
