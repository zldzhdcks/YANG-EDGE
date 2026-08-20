/**
 * Hitting gameLog → counting sums + explicit derived rates.
 * Missing API fields stay null. No silent league-average fill.
 */
import type { GameLogSplit } from "../build-pitcher-stat-candidate";
import {
  emptyCounting,
  emptyDerived,
  emptyRates,
  emptySampleSize,
  type BatterCountingStats,
  type BatterDerivedMeta,
  type BatterRateStats,
  type BatterSampleSize,
} from "./types";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function sumField(
  splits: GameLogSplit[],
  key: string,
): { total: number | null; present: number } {
  let total = 0;
  let present = 0;
  for (const split of splits) {
    const v = asNumber(split.stat?.[key]);
    if (v == null) continue;
    total += v;
    present += 1;
  }
  return { total: present === 0 ? null : total, present };
}

export function aggregateHittingFromGameLog(splits: GameLogSplit[]): {
  counting: BatterCountingStats;
  rates: BatterRateStats;
  sampleSize: BatterSampleSize;
  countingDerived: BatterDerivedMeta;
  ratesDerived: BatterDerivedMeta;
} {
  if (splits.length === 0) {
    return {
      counting: emptyCounting(),
      rates: emptyRates(),
      sampleSize: emptySampleSize(),
      countingDerived: emptyDerived(),
      ratesDerived: emptyDerived(),
    };
  }

  const pa = sumField(splits, "plateAppearances");
  const ab = sumField(splits, "atBats");
  const h = sumField(splits, "hits");
  const doubles = sumField(splits, "doubles");
  const triples = sumField(splits, "triples");
  const hr = sumField(splits, "homeRuns");
  const runs = sumField(splits, "runs");
  const rbi = sumField(splits, "rbi");
  const bb = sumField(splits, "baseOnBalls");
  const so = sumField(splits, "strikeOuts");
  const hbp = sumField(splits, "hitByPitch");
  const sf = sumField(splits, "sacFlies");
  const tb = sumField(splits, "totalBases");
  const gp = sumField(splits, "gamesPlayed");

  const counting: BatterCountingStats = {
    gamesPlayed: gp.total ?? splits.length,
    plateAppearances: pa.total,
    atBats: ab.total,
    hits: h.total,
    doubles: doubles.total,
    triples: triples.total,
    homeRuns: hr.total,
    runs: runs.total,
    rbi: rbi.total,
    baseOnBalls: bb.total,
    strikeOuts: so.total,
    hitByPitch: hbp.total,
    sacFlies: sf.total,
    totalBases: tb.total,
  };

  const rates: BatterRateStats = { ...emptyRates() };
  const rateInputs: string[] = [];

  if (h.total != null && ab.total != null && ab.total > 0) {
    rates.avg = round4(h.total / ab.total);
    rateInputs.push("hits", "atBats");
  }
  const obpNum =
    h.total != null && bb.total != null && hbp.total != null
      ? h.total + bb.total + hbp.total
      : null;
  const obpDen =
    ab.total != null && bb.total != null && hbp.total != null && sf.total != null
      ? ab.total + bb.total + hbp.total + sf.total
      : null;
  if (obpNum != null && obpDen != null && obpDen > 0) {
    rates.obp = round4(obpNum / obpDen);
    rateInputs.push("baseOnBalls", "hitByPitch", "sacFlies");
  }
  if (tb.total != null && ab.total != null && ab.total > 0) {
    rates.slg = round4(tb.total / ab.total);
    rateInputs.push("totalBases");
  }
  if (rates.obp != null && rates.slg != null) {
    rates.ops = round4(rates.obp + rates.slg);
  }
  const babipNum =
    h.total != null && hr.total != null ? h.total - hr.total : null;
  const babipDen =
    ab.total != null && so.total != null && hr.total != null && sf.total != null
      ? ab.total - so.total - hr.total + sf.total
      : null;
  if (babipNum != null && babipDen != null && babipDen > 0) {
    rates.babip = round4(babipNum / babipDen);
    rateInputs.push("strikeOuts", "homeRuns");
  }

  return {
    counting,
    rates,
    sampleSize: {
      games: counting.gamesPlayed,
      pa: counting.plateAppearances,
      ab: counting.atBats,
    },
    countingDerived: {
      derived: true,
      formula: "sum(gameLog.stat.field) over splits with date<=statsThroughDate",
      sourceInputs: [
        "mlb-stats-api people stats gameLog group=hitting",
      ],
      denominator: "kept gameLog splits",
    },
    ratesDerived: {
      derived: rates.avg != null || rates.obp != null,
      formula:
        "AVG=H/AB; OBP=(H+BB+HBP)/(AB+BB+HBP+SF); SLG=TB/AB; OPS=OBP+SLG; BABIP=(H-HR)/(AB-SO-HR+SF)",
      sourceInputs: [...new Set(rateInputs)],
      denominator: "counting sums from cutoff-filtered gameLog",
    },
  };
}

export function batsFromPerson(payload: unknown): {
  bats: "L" | "R" | "S" | "UNKNOWN";
  primaryPosition: string | null;
  fullName: string | null;
} {
  const root =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  const people = Array.isArray(root?.people) ? root!.people : [];
  const person =
    people.length > 0 && typeof people[0] === "object" && people[0] !== null
      ? (people[0] as Record<string, unknown>)
      : root;
  const batSide =
    person && typeof person.batSide === "object" && person.batSide !== null
      ? (person.batSide as Record<string, unknown>)
      : null;
  const code =
    typeof batSide?.code === "string" ? batSide.code.trim().toUpperCase() : "";
  const bats = code === "L" || code === "R" || code === "S" ? code : "UNKNOWN";
  const pos =
    person &&
    typeof person.primaryPosition === "object" &&
    person.primaryPosition !== null
      ? (person.primaryPosition as Record<string, unknown>)
      : null;
  const abbreviation =
    typeof pos?.abbreviation === "string" ? pos.abbreviation : null;
  const fullName = typeof person?.fullName === "string" ? person.fullName : null;
  return { bats, primaryPosition: abbreviation, fullName };
}

export function parseGameLogSplits(payload: unknown): GameLogSplit[] {
  const root =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  const stats = Array.isArray(root?.stats) ? root!.stats : [];
  const first =
    stats[0] && typeof stats[0] === "object"
      ? (stats[0] as Record<string, unknown>)
      : null;
  const splits = Array.isArray(first?.splits) ? first!.splits : [];
  const out: GameLogSplit[] = [];
  for (const raw of splits) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const game =
      typeof row.game === "object" && row.game !== null
        ? (row.game as Record<string, unknown>)
        : null;
    const stat =
      typeof row.stat === "object" && row.stat !== null
        ? (row.stat as Record<string, unknown>)
        : undefined;
    out.push({
      date: typeof row.date === "string" ? row.date : undefined,
      game: game
        ? { gamePk: typeof game.gamePk === "number" ? game.gamePk : undefined }
        : undefined,
      stat,
    });
  }
  return out;
}
