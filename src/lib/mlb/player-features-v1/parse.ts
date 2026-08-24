import type { GameLogSplit } from "../build-pitcher-stat-candidate";
import { latestIncludedGameDate } from "../batter-dataset-v0/cutoff";
import {
  aggregateHittingFromGameLog,
  batsFromPerson,
  parseGameLogSplits,
} from "../batter-dataset-v0/hitting";
import { aggregatePitchingFromGameLog } from "../build-pitcher-stat-candidate";
import {
  assertNoOfficialDateLeak,
  filterGameLogAsOf,
  filterSplitsByInclusiveWindow,
  recentWindowStartDate,
} from "./temporal";
import {
  bbRate,
  hr9,
  hrRate,
  isoFromSlgAvg,
  kMinusBbRate,
  kRate,
} from "./rates";
import { batterPaReliability, pitcherIpReliability } from "./reliability";
import type {
  Availability,
  CountingBlock,
  FeatureWindow,
  HandCode,
  PlatoonSplit,
  RateBlock,
  StarterFeatureRow,
} from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function emptyCounting(): CountingBlock {
  return {
    pa: null,
    ab: null,
    h: null,
    doubles: null,
    triples: null,
    hr: null,
    bb: null,
    so: null,
    tb: null,
    gamesPlayed: null,
  };
}

export function emptyWindow(
  windowId: FeatureWindow["windowId"],
  windowEndDate: string,
  windowStartDate: string | null,
): FeatureWindow {
  const counting = emptyCounting();
  const rates: RateBlock = {
    avg: null,
    obp: null,
    slg: null,
    ops: null,
    babip: null,
    iso: isoFromSlgAvg(null, null),
  };
  return {
    windowId,
    windowStartDate,
    windowEndDate,
    counting,
    rates,
    derived: {
      kRate: kRate(null, null),
      bbRate: bbRate(null, null),
      hrRate: hrRate(null, null),
    },
    sampleSizePa: null,
    reliability: batterPaReliability(null),
    latestIncludedGameDate: null,
    excludedTargetGame: 0,
    excludedOnOrAfterOfficialDate: 0,
    availability: "NOT_AVAILABLE",
  };
}

export function throwsFromPerson(payload: unknown): HandCode {
  const root = asRecord(payload);
  const people = Array.isArray(root?.people) ? root!.people : [];
  const person =
    people[0] && typeof people[0] === "object"
      ? (people[0] as Record<string, unknown>)
      : root;
  const pitchHand = asRecord(person?.pitchHand);
  const code = asString(pitchHand?.code)?.toUpperCase();
  if (code === "L" || code === "R") return code;
  return "UNKNOWN";
}

export function batsFromPersonPayload(payload: unknown): {
  bats: HandCode;
  fullName: string | null;
  primaryPosition: string | null;
} {
  return batsFromPerson(payload);
}

export function buildHittingWindow(input: {
  payload: unknown | null;
  targetGamePk: number;
  officialDate: string | null;
  statsThroughDate: string;
  windowId: FeatureWindow["windowId"];
  inclusiveDays?: number;
}): FeatureWindow {
  const windowStartDate =
    input.windowId === "SEASON_TO_DATE" || input.inclusiveDays == null
      ? null
      : recentWindowStartDate(input.statsThroughDate, input.inclusiveDays);
  if (input.payload == null) {
    return emptyWindow(input.windowId, input.statsThroughDate, windowStartDate);
  }
  const all = parseGameLogSplits(input.payload);
  const filtered = filterGameLogAsOf({
    splits: all,
    targetGamePk: input.targetGamePk,
    statsThroughDate: input.statsThroughDate,
  });
  let kept = filtered.kept;
  if (windowStartDate) {
    kept = filterSplitsByInclusiveWindow(
      kept,
      windowStartDate,
      input.statsThroughDate,
    );
  }
  assertNoOfficialDateLeak({
    splits: kept,
    officialDate: input.officialDate,
    statsThroughDate: input.statsThroughDate,
  });
  if (kept.length === 0) {
    const empty = emptyWindow(
      input.windowId,
      input.statsThroughDate,
      windowStartDate,
    );
    empty.excludedTargetGame = filtered.excludedTarget;
    empty.excludedOnOrAfterOfficialDate = filtered.excludedSameDayOrLater;
    empty.availability = "COLLECTED";
    return empty;
  }
  const agg = aggregateHittingFromGameLog(kept);
  const counting: CountingBlock = {
    pa: agg.counting.plateAppearances,
    ab: agg.counting.atBats,
    h: agg.counting.hits,
    doubles: agg.counting.doubles,
    triples: agg.counting.triples,
    hr: agg.counting.homeRuns,
    bb: agg.counting.baseOnBalls,
    so: agg.counting.strikeOuts,
    tb: agg.counting.totalBases,
    gamesPlayed: agg.counting.gamesPlayed,
  };
  const rates: RateBlock = {
    avg: agg.rates.avg,
    obp: agg.rates.obp,
    slg: agg.rates.slg,
    ops: agg.rates.ops,
    babip: agg.rates.babip,
    iso: isoFromSlgAvg(agg.rates.slg, agg.rates.avg),
  };
  return {
    windowId: input.windowId,
    windowStartDate,
    windowEndDate: input.statsThroughDate,
    counting,
    rates,
    derived: {
      kRate: kRate(counting.so, counting.pa),
      bbRate: bbRate(counting.bb, counting.pa),
      hrRate: hrRate(counting.hr, counting.pa),
    },
    sampleSizePa: counting.pa,
    reliability: batterPaReliability(counting.pa),
    latestIncludedGameDate: latestIncludedGameDate(kept),
    excludedTargetGame: filtered.excludedTarget,
    excludedOnOrAfterOfficialDate: filtered.excludedSameDayOrLater,
    availability: "COLLECTED",
  };
}

function sumStat(splits: GameLogSplit[], key: string): number | null {
  let total = 0;
  let present = 0;
  for (const split of splits) {
    const v = asNumber(split.stat?.[key]);
    if (v == null) continue;
    total += v;
    present += 1;
  }
  return present === 0 ? null : total;
}

export function emptyStarterSeason(): StarterFeatureRow["seasonToDate"] {
  const k = kRate(null, null);
  const bb = bbRate(null, null);
  return {
    ip: null,
    era: null,
    whip: null,
    so: null,
    bb: null,
    hr: null,
    bf: null,
    gamesStarted: null,
    derived: {
      kRate: k,
      bbRate: bb,
      kMinusBbRate: kMinusBbRate(k, bb),
      hr9: hr9(null, null),
    },
    sampleSizeBf: null,
    sampleSizeIp: null,
    reliability: pitcherIpReliability(null),
    latestIncludedGameDate: null,
    excludedTargetGame: 0,
    excludedOnOrAfterOfficialDate: 0,
    availability: "NOT_AVAILABLE",
  };
}

export function buildStarterSeason(input: {
  payload: unknown | null;
  targetGamePk: number;
  officialDate: string | null;
  statsThroughDate: string;
}): StarterFeatureRow["seasonToDate"] {
  if (input.payload == null) return emptyStarterSeason();
  const all = parseGameLogSplits(input.payload);
  const filtered = filterGameLogAsOf({
    splits: all,
    targetGamePk: input.targetGamePk,
    statsThroughDate: input.statsThroughDate,
  });
  assertNoOfficialDateLeak({
    splits: filtered.kept,
    officialDate: input.officialDate,
    statsThroughDate: input.statsThroughDate,
  });
  const agg = aggregatePitchingFromGameLog(filtered.kept);
  const bf = sumStat(filtered.kept, "battersFaced");
  const ip = agg.inningsPitched;
  const so = agg.strikeOuts;
  const bb = agg.baseOnBalls;
  const hr = agg.homeRuns;
  const k = kRate(so, bf);
  const bbR = bbRate(bb, bf);
  return {
    ip,
    era: agg.seasonEra,
    whip: agg.seasonWhip,
    so,
    bb,
    hr,
    bf,
    gamesStarted: agg.gamesStarted,
    derived: {
      kRate: k,
      bbRate: bbR,
      kMinusBbRate: kMinusBbRate(k, bbR),
      hr9: hr9(hr, ip),
    },
    sampleSizeBf: bf,
    sampleSizeIp: ip,
    reliability: pitcherIpReliability(ip),
    latestIncludedGameDate: latestIncludedGameDate(filtered.kept),
    excludedTargetGame: filtered.excludedTarget,
    excludedOnOrAfterOfficialDate: filtered.excludedSameDayOrLater,
    availability: "COLLECTED",
  };
}

function emptyPlatoon(
  splitId: PlatoonSplit["splitId"],
  availability: Availability,
  dateBounded: boolean,
): PlatoonSplit {
  return {
    splitId,
    pa: null,
    avg: null,
    obp: null,
    slg: null,
    ops: null,
    babip: null,
    hr: null,
    bb: null,
    so: null,
    sampleSizePa: null,
    reliability: batterPaReliability(null),
    availability,
    dateBounded,
  };
}

function splitCode(row: Record<string, unknown>): string {
  const split = asRecord(row.split);
  return (asString(split?.code) ?? asString(row.splitCode) ?? "")
    .trim()
    .toLowerCase();
}

function platoonFromStat(
  splitId: PlatoonSplit["splitId"],
  stat: Record<string, unknown> | null,
  dateBounded: boolean,
  availability: Availability,
): PlatoonSplit {
  if (!stat) return emptyPlatoon(splitId, availability, dateBounded);
  const pa = asNumber(stat.plateAppearances);
  return {
    splitId,
    pa,
    avg: asNumber(stat.avg),
    obp: asNumber(stat.obp),
    slg: asNumber(stat.slg),
    ops: asNumber(stat.ops),
    babip: asNumber(stat.babip),
    hr: asNumber(stat.homeRuns),
    bb: asNumber(stat.baseOnBalls),
    so: asNumber(stat.strikeOuts),
    sampleSizePa: pa,
    reliability: batterPaReliability(pa),
    availability,
    dateBounded,
  };
}

export function parsePlatoonSplits(input: {
  payload: unknown | null;
  dateBounded: boolean;
}): { vsLhp: PlatoonSplit; vsRhp: PlatoonSplit } {
  const availability: Availability = input.payload
    ? input.dateBounded
      ? "COLLECTED"
      : "NOT_PROVABLE"
    : "NOT_AVAILABLE";
  let vsLhp = emptyPlatoon("VS_LHP", availability, input.dateBounded);
  let vsRhp = emptyPlatoon("VS_RHP", availability, input.dateBounded);
  if (input.payload == null) return { vsLhp, vsRhp };
  const root = asRecord(input.payload);
  const stats = Array.isArray(root?.stats) ? root!.stats : [];
  const first = asRecord(stats[0]);
  const splits = Array.isArray(first?.splits) ? first!.splits : [];
  for (const raw of splits) {
    const row = asRecord(raw);
    if (!row) continue;
    const code = splitCode(row);
    const stat = asRecord(row.stat);
    if (code === "vl" || code === "lhp" || code.includes("left")) {
      vsLhp = platoonFromStat("VS_LHP", stat, input.dateBounded, availability);
    } else if (code === "vr" || code === "rhp" || code.includes("right")) {
      vsRhp = platoonFromStat("VS_RHP", stat, input.dateBounded, availability);
    }
  }
  return { vsLhp, vsRhp };
}

export function selectedPlatoonSplit(
  opponentThrows: HandCode,
): "VS_LHP" | "VS_RHP" | null {
  if (opponentThrows === "L") return "VS_LHP";
  if (opponentThrows === "R") return "VS_RHP";
  return null;
}
