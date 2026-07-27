/**
 * Bullpen Role Classifier v1.1 — 순수 분류.
 *
 * - traditional starter(slot0 & outs≥9) 제외
 * - opener 짧은 slot0는 유지
 * - 역할별 독립 score → primary/secondary
 * - sample 0–2 → UNKNOWN + INSUFFICIENT_SAMPLE
 * - Engine 미연결 · engineEligible 항상 false
 */
import {
  CLOSER_FINISH_RATE_MIN,
  CLOSER_LATE_CLOSE_RATE_MIN,
  CLOSER_SAVE_RATE_MIN,
  CLOSER_SAVES_ABS_MIN,
  HL_MIN_SAMPLE_FOR_MODERATE,
  HL_RATE_MODERATE,
  HL_RATE_STRONG,
  LONG_EARLY_ENTRY_RATE_MIN,
  LONG_HL_RATE_MAX,
  LONG_MEDIAN_OUTS_MIN,
  LONG_MULTI_INNING_RATE_MIN,
  MIDDLE_ENTRY_INNING_MAX,
  MIDDLE_ENTRY_INNING_MIN,
  MIDDLE_HL_RATE_MAX,
  MIDDLE_MOP_RATE_MAX,
  MIDDLE_TYPICAL_OUTS_MAX,
  MIDDLE_TYPICAL_OUTS_MIN,
  MOP_MIN_SAMPLE,
  MOP_RATE_MIN,
  OPENER_MAX_OUTS_EXCLUSIVE,
  OPENER_MIN_SHORT_STARTS,
  OPENER_SHORT_START_RATE_MIN,
  PRIMARY_ROLE_MIN_SCORE,
  SAMPLE_INSUFFICIENT_MAX,
  SAMPLE_PROVISIONAL_MAX,
  SECONDARY_ROLE_MAX_SCORE_GAP,
  SECONDARY_ROLE_MIN_SCORE,
  SETUP_HOLD_RATE_MIN,
  SETUP_HOLDS_ABS_MIN,
  SETUP_INNING_CLOSE_RATE_MIN,
  TRADITIONAL_STARTER_MIN_OUTS,
} from "./bullpen-role-constants";
import type {
  BullpenAppearanceDerived,
  BullpenRole,
  ClassifiedBullpenPitcher,
  ClassificationStatus,
  PitcherFatigueSnapshot,
  RestBucketKey,
  RestBucketStats,
  RoleConfidence,
  RoleEvidence,
} from "./bullpen-role-types";

function round3(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function outsToIp(outs: number): number {
  return Math.floor(outs / 3) + (outs % 3) / 10;
}

function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return round3(num / den);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

function isCloseGameDiff(diff: number | null): boolean {
  return diff != null && Math.abs(diff) <= 3;
}

function isMopDiff(diff: number | null): boolean {
  return diff != null && Math.abs(diff) >= 4;
}

/** traditional starter: 선발 슬롯 + 충분히 긴 투구 */
export function isTraditionalStarterAppearance(
  a: BullpenAppearanceDerived,
): boolean {
  return (
    a.pitcherSlotIndex === 0 && a.outs >= TRADITIONAL_STARTER_MIN_OUTS
  );
}

/** opener 후보: 선발 슬롯 + 짧은 이닝 (제거하지 않음) */
export function isOpenerSlotAppearance(
  a: BullpenAppearanceDerived,
): boolean {
  return (
    a.pitcherSlotIndex === 0 && a.outs < OPENER_MAX_OUTS_EXCLUSIVE
  );
}

/** 역할 feature용 relief (slot≥1) */
export function isReliefAppearance(a: BullpenAppearanceDerived): boolean {
  return a.pitcherSlotIndex >= 1;
}

export function partitionAppearances(apps: BullpenAppearanceDerived[]): {
  relief: BullpenAppearanceDerived[];
  opener: BullpenAppearanceDerived[];
  traditionalStarterExcluded: BullpenAppearanceDerived[];
} {
  const relief: BullpenAppearanceDerived[] = [];
  const opener: BullpenAppearanceDerived[] = [];
  const traditionalStarterExcluded: BullpenAppearanceDerived[] = [];
  for (const a of apps) {
    if (isTraditionalStarterAppearance(a)) {
      traditionalStarterExcluded.push(a);
    } else if (isOpenerSlotAppearance(a)) {
      opener.push(a);
    } else if (isReliefAppearance(a)) {
      relief.push(a);
    } else {
      // slot0 edge: should be covered; treat as excluded starter
      traditionalStarterExcluded.push(a);
    }
  }
  return { relief, opener, traditionalStarterExcluded };
}

export function buildFatigueSnapshot(
  appearances: BullpenAppearanceDerived[],
  officialDate: string,
): PitcherFatigueSnapshot {
  // fatigue: relief + opener only (no traditional starter)
  const { relief, opener } = partitionAppearances(appearances);
  const sorted = [...relief, ...opener].sort((a, b) =>
    a.officialDate.localeCompare(b.officialDate),
  );
  const d1 = addDays(officialDate, -1);
  const d2 = addDays(officialDate, -2);
  const inWindow = (from: string, to: string) =>
    sorted.filter((a) => a.officialDate >= from && a.officialDate <= to);

  const last2 = inWindow(addDays(officialDate, -2), d1);
  const last3 = inWindow(addDays(officialDate, -3), d1);
  const last5 = inWindow(addDays(officialDate, -5), d1);
  const prev = sorted.filter((a) => a.officialDate === d1);
  const lastDate =
    sorted.length > 0 ? sorted[sorted.length - 1]!.officialDate : null;
  const daysSince =
    lastDate != null ? daysBetween(lastDate, officialDate) : null;

  let consecutive = 0;
  for (let i = 1; i <= 10; i += 1) {
    const day = addDays(officialDate, -i);
    if (sorted.some((a) => a.officialDate === day)) consecutive += 1;
    else break;
  }

  const sumPitches = (rows: BullpenAppearanceDerived[]) => {
    const vals = rows
      .map((a) => a.pitches)
      .filter((n): n is number => n != null);
    if (vals.length === 0) return null;
    return vals.reduce((s, n) => s + n, 0);
  };
  const sumOuts = (rows: BullpenAppearanceDerived[]) =>
    rows.reduce((s, a) => s + a.outs, 0);
  const sumBf = (rows: BullpenAppearanceDerived[]) => {
    const vals = rows
      .map((a) => a.battersFaced)
      .filter((n): n is number => n != null);
    if (vals.length === 0) return null;
    return vals.reduce((s, n) => s + n, 0);
  };

  const usedPrev = prev.length > 0;
  const usedD2 = sorted.some((a) => a.officialDate === d2);

  return {
    daysSinceLastAppearance: daysSince,
    appearancesLast2Days: last2.length,
    appearancesLast3Days: last3.length,
    appearancesLast5Days: last5.length,
    consecutiveDaysPitched: consecutive,
    pitchesPreviousDay: sumPitches(prev),
    pitchesLast2Days: sumPitches(last2),
    pitchesLast3Days: sumPitches(last3),
    inningsLast3Days: round3(outsToIp(sumOuts(last3))),
    battersFacedLast3Days: sumBf(last3),
    restDaysBeforeGame: daysSince,
    usedPreviousDay: usedPrev,
    usedBackToBack: usedPrev && usedD2,
    possibleThirdConsecutiveDay: usedPrev && usedD2,
  };
}

function restBucketForGap(gapDays: number): RestBucketKey {
  if (gapDays <= 0) return "0";
  if (gapDays === 1) return "1";
  if (gapDays === 2) return "2";
  if (gapDays === 3) return "3";
  return "4plus";
}

export function buildRestBuckets(
  appearances: BullpenAppearanceDerived[],
): RestBucketStats[] {
  const { relief, opener } = partitionAppearances(appearances);
  const sorted = [...relief, ...opener].sort((a, b) =>
    a.officialDate.localeCompare(b.officialDate),
  );
  const buckets: Record<
    RestBucketKey,
    {
      outs: number;
      er: number;
      hits: number;
      walks: number;
      so: number;
      hr: number;
      runs: number;
      n: number;
    }
  > = {
    "0": { outs: 0, er: 0, hits: 0, walks: 0, so: 0, hr: 0, runs: 0, n: 0 },
    "1": { outs: 0, er: 0, hits: 0, walks: 0, so: 0, hr: 0, runs: 0, n: 0 },
    "2": { outs: 0, er: 0, hits: 0, walks: 0, so: 0, hr: 0, runs: 0, n: 0 },
    "3": { outs: 0, er: 0, hits: 0, walks: 0, so: 0, hr: 0, runs: 0, n: 0 },
    "4plus": { outs: 0, er: 0, hits: 0, walks: 0, so: 0, hr: 0, runs: 0, n: 0 },
  };

  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i]!;
    const prev = sorted[i - 1]!;
    const gap = Math.max(
      0,
      daysBetween(prev.officialDate, cur.officialDate) - 1,
    );
    const b = buckets[restBucketForGap(gap)];
    b.n += 1;
    b.outs += cur.outs;
    b.er += cur.earnedRuns;
    b.hits += cur.hits;
    b.walks += cur.walks;
    b.so += cur.strikeouts;
    b.hr += cur.homeRuns;
    b.runs += cur.earnedRuns;
  }

  return (Object.keys(buckets) as RestBucketKey[]).map((bucket) => {
    const b = buckets[bucket];
    const ip = b.outs / 3;
    return {
      bucket,
      appearances: b.n,
      era: b.outs > 0 ? round3((b.er * 9) / ip) : null,
      whip: b.outs > 0 ? round3((b.hits + b.walks) / ip) : null,
      runsAllowed: b.runs,
      walks: b.walks,
      strikeouts: b.so,
      homeRunsAllowed: b.hr,
      sampleThin: b.n < 3,
    };
  });
}

export function buildRoleEvidence(
  appearances: BullpenAppearanceDerived[],
): RoleEvidence {
  const { relief, opener, traditionalStarterExcluded } =
    partitionAppearances(appearances);

  // 핵심 feature: relief only (avgOuts 등). opener는 OPENER rate에만.
  const featureApps = relief;
  const n = featureApps.length;
  const notes: string[] = [];
  if (traditionalStarterExcluded.length > 0) {
    notes.push(
      `TRADITIONAL_STARTER_EXCLUDED:${traditionalStarterExcluded.length}`,
    );
  }

  const saves = featureApps.reduce((s, a) => s + a.saves, 0);
  const holds = featureApps.reduce((s, a) => s + a.holds, 0);
  const finishes = featureApps.filter((a) => a.wasLastPitcher).length;
  const totalOuts = featureApps.reduce((s, a) => s + a.outs, 0);
  const outsList = featureApps.map((a) => a.outs);
  const multiInning = featureApps.filter((a) => a.outs >= 6).length;

  const withEntry = featureApps.filter((a) => a.entryInning != null);
  const lateClose = withEntry.filter(
    (a) =>
      (a.entryInning ?? 0) >= 9 && isCloseGameDiff(a.entryScoreDiff),
  ).length;
  const setupInn = withEntry.filter(
    (a) =>
      (a.entryInning === 7 || a.entryInning === 8) &&
      isCloseGameDiff(a.entryScoreDiff),
  ).length;
  const highLev = withEntry.filter(
    (a) =>
      (a.entryInning ?? 0) >= 6 && isCloseGameDiff(a.entryScoreDiff),
  ).length;
  const mop = withEntry.filter((a) => isMopDiff(a.entryScoreDiff)).length;
  const early = withEntry.filter((a) => (a.entryInning ?? 99) <= 5).length;
  const middleEntry = withEntry.filter((a) => {
    const inn = a.entryInning ?? -1;
    return (
      inn >= MIDDLE_ENTRY_INNING_MIN &&
      inn <= MIDDLE_ENTRY_INNING_MAX &&
      !isMopDiff(a.entryScoreDiff)
    );
  }).length;

  const shortStarts = opener.filter((a) => a.outs < OPENER_MAX_OUTS_EXCLUSIVE);
  const sampleForStatus = n + opener.length;
  if (sampleForStatus < 3) notes.push("SAMPLE_THIN");
  if (withEntry.length === 0 && n > 0) {
    notes.push("ENTRY_INNING_SCORE_UNAVAILABLE");
  }

  return {
    savesLast30: saves,
    holdsLast30: holds,
    appearancesLast30: sampleForStatus,
    reliefAppearances: n,
    openerAppearances: opener.length,
    traditionalStarterExcluded: traditionalStarterExcluded.length,
    finishRate: rate(finishes, n),
    saveRate: rate(saves, n),
    holdRate: rate(holds, n),
    avgOuts: n > 0 ? round3(totalOuts / n) : null,
    medianOuts: round3(median(outsList)),
    multiInningRate: rate(multiInning, n),
    earlyEntryRate: rate(early, withEntry.length),
    middleEntryRate: rate(middleEntry, withEntry.length),
    lateCloseEntryRate: rate(lateClose, withEntry.length),
    setupInningCloseRate: rate(setupInn, withEntry.length),
    highLeverageRate: rate(highLev, withEntry.length),
    mopUpRate: rate(mop, withEntry.length),
    starterShortOutingRate: rate(
      shortStarts.length,
      opener.length || shortStarts.length,
    ),
    notes,
  };
}

/** 역할별 독립 score (0 = 신호 없음) */
export function computeRoleScores(
  ev: RoleEvidence,
): Partial<Record<BullpenRole, number>> {
  const scores: Partial<Record<BullpenRole, number>> = {};
  const n = ev.reliefAppearances;
  const sample = ev.appearancesLast30;

  // CLOSER
  let closer = 0;
  if ((ev.saveRate ?? 0) >= CLOSER_SAVE_RATE_MIN || ev.savesLast30 >= CLOSER_SAVES_ABS_MIN) {
    closer += 3;
  }
  if ((ev.finishRate ?? 0) >= CLOSER_FINISH_RATE_MIN && ev.savesLast30 >= 1) {
    closer += 2;
  }
  if ((ev.lateCloseEntryRate ?? 0) >= CLOSER_LATE_CLOSE_RATE_MIN) {
    closer += 2;
  }
  if (closer > 0) scores.CLOSER = closer;

  // SETUP
  let setup = 0;
  if ((ev.holdRate ?? 0) >= SETUP_HOLD_RATE_MIN || ev.holdsLast30 >= SETUP_HOLDS_ABS_MIN) {
    setup += 3;
  }
  if ((ev.setupInningCloseRate ?? 0) >= SETUP_INNING_CLOSE_RATE_MIN) {
    setup += 2;
  }
  if (
    (ev.finishRate ?? 0) < 0.35 &&
    (ev.saveRate ?? 0) < 0.2 &&
    ev.holdsLast30 >= 1
  ) {
    setup += 1;
  }
  if (setup > 0) scores.SETUP = setup;

  // HIGH_LEVERAGE
  let hl = 0;
  if ((ev.highLeverageRate ?? 0) >= HL_RATE_STRONG && (ev.saveRate ?? 0) < 0.25) {
    hl += 3;
  }
  if (
    (ev.highLeverageRate ?? 0) >= HL_RATE_MODERATE &&
    ev.savesLast30 + ev.holdsLast30 <= 1 &&
    n >= HL_MIN_SAMPLE_FOR_MODERATE
  ) {
    hl += 2;
  }
  if (hl > 0) scores.HIGH_LEVERAGE_RELIEF = hl;

  // LONG — multi-factor (avgOuts 단독 금지)
  let long = 0;
  if ((ev.multiInningRate ?? 0) >= LONG_MULTI_INNING_RATE_MIN) long += 2;
  if ((ev.medianOuts ?? 0) >= LONG_MEDIAN_OUTS_MIN) long += 2;
  if ((ev.earlyEntryRate ?? 0) >= LONG_EARLY_ENTRY_RATE_MIN) long += 1;
  if (
    ev.highLeverageRate != null &&
    ev.highLeverageRate <= LONG_HL_RATE_MAX &&
    (ev.multiInningRate ?? 0) >= 0.25
  ) {
    long += 1;
  }
  if (n >= 4 && long >= 2) long += 1; // sample support
  if (long >= PRIMARY_ROLE_MIN_SCORE) scores.LONG_RELIEF = long;

  // MIDDLE — 독립 score (fallback 아님). mop와 겹치지 않게 mopRate 상한.
  let middle = 0;
  if ((ev.middleEntryRate ?? 0) >= 0.3) middle += 2;
  if (
    (ev.avgOuts ?? 0) >= MIDDLE_TYPICAL_OUTS_MIN &&
    (ev.avgOuts ?? 0) <= MIDDLE_TYPICAL_OUTS_MAX
  ) {
    middle += 2;
  }
  if (
    ev.highLeverageRate != null &&
    ev.highLeverageRate <= MIDDLE_HL_RATE_MAX
  ) {
    middle += 1;
  }
  if ((ev.mopUpRate ?? 1) <= MIDDLE_MOP_RATE_MAX) middle += 1;
  if (
    (ev.saveRate ?? 0) < 0.2 &&
    (ev.holdRate ?? 0) < 0.25 &&
    n >= 3
  ) {
    middle += 1;
  }
  if (middle >= PRIMARY_ROLE_MIN_SCORE) scores.MIDDLE_RELIEF = middle;

  // MOP_UP — blowout evidence only
  let mop = 0;
  if ((ev.mopUpRate ?? 0) >= MOP_RATE_MIN && sample >= MOP_MIN_SAMPLE) {
    mop += 3;
  }
  if ((ev.mopUpRate ?? 0) >= 0.6 && (ev.middleEntryRate ?? 1) < 0.25) {
    mop += 1;
  }
  if (mop >= PRIMARY_ROLE_MIN_SCORE) scores.MOP_UP = mop;

  // OPENER
  if (
    (ev.starterShortOutingRate ?? 0) >= OPENER_SHORT_START_RATE_MIN &&
    ev.openerAppearances >= OPENER_MIN_SHORT_STARTS
  ) {
    scores.OPENER = 3;
  }

  return scores;
}

function classificationStatusFor(sampleSize: number): ClassificationStatus {
  if (sampleSize <= SAMPLE_INSUFFICIENT_MAX) return "INSUFFICIENT_SAMPLE";
  if (sampleSize <= SAMPLE_PROVISIONAL_MAX) return "PROVISIONAL";
  return "CLASSIFIED";
}

function pickPrimaryAndSecondary(
  scores: Partial<Record<BullpenRole, number>>,
): { primary: BullpenRole; secondary: BullpenRole[] } {
  const entries = (
    Object.entries(scores) as Array<[BullpenRole, number]>
  )
    .filter(([, s]) => s >= PRIMARY_ROLE_MIN_SCORE)
    .sort(
      (a, b) =>
        b[1] - a[1] || a[0].localeCompare(b[0]),
    );

  if (entries.length === 0) {
    return { primary: "UNKNOWN", secondary: [] };
  }

  const primary = entries[0]![0];
  const primaryScore = entries[0]![1];
  const secondary = entries
    .slice(1)
    .filter(
      ([, s]) =>
        s >= SECONDARY_ROLE_MIN_SCORE &&
        primaryScore - s <= SECONDARY_ROLE_MAX_SCORE_GAP,
    )
    .map(([r]) => r);

  return { primary, secondary };
}

function confidenceFrom(
  status: ClassificationStatus,
  scores: Partial<Record<BullpenRole, number>>,
  sampleSize: number,
  notes: string[],
): RoleConfidence {
  if (status === "INSUFFICIENT_SAMPLE") return "low";

  const top = Math.max(0, ...Object.values(scores).map((s) => s ?? 0));
  let conf: RoleConfidence = "low";
  if (
    sampleSize >= 8 &&
    top >= 4 &&
    !notes.includes("ENTRY_INNING_SCORE_UNAVAILABLE")
  ) {
    conf = "high";
  } else if (sampleSize >= 5 && top >= 3) {
    conf = "medium";
  } else if (sampleSize >= 3 && top >= 3) {
    conf = "medium";
  }

  // PROVISIONAL 표본 패널티
  if (status === "PROVISIONAL") {
    if (conf === "high") conf = "medium";
    else if (conf === "medium") conf = "low";
  }
  return conf;
}

export function classifyBullpenPitcher(input: {
  playerId: number;
  playerName: string | null;
  teamId: number;
  teamName: string;
  cutoffTime: string;
  officialDate: string;
  appearances: BullpenAppearanceDerived[];
}): ClassifiedBullpenPitcher {
  const apps = input.appearances.filter((a) => a.fromTargetGame === false);
  const evidence = buildRoleEvidence(apps);
  const sampleSize = evidence.appearancesLast30;
  const status = classificationStatusFor(sampleSize);
  const warnings = [...evidence.notes];

  let roleScores: Partial<Record<BullpenRole, number>> = {};
  let primary: BullpenRole = "UNKNOWN";
  let secondary: BullpenRole[] = [];

  if (status === "INSUFFICIENT_SAMPLE") {
    primary = "UNKNOWN";
    secondary = [];
    roleScores = {};
    warnings.push("INSUFFICIENT_SAMPLE_FORCE_UNKNOWN");
  } else {
    roleScores = computeRoleScores(evidence);
    const picked = pickPrimaryAndSecondary(roleScores);
    primary = picked.primary;
    secondary = picked.secondary;
  }

  // 안전장치: 표본 3 미만 확정 LONG 불가 (status가 INSUFFICIENT면 이미 UNKNOWN)
  if (
    sampleSize < 3 &&
    primary === "LONG_RELIEF"
  ) {
    primary = "UNKNOWN";
    secondary = [];
    warnings.push("LONG_BLOCKED_INSUFFICIENT_SAMPLE");
  }

  const confidence = confidenceFrom(
    status,
    roleScores,
    sampleSize,
    evidence.notes,
  );
  if (confidence === "low") {
    warnings.push("LOW_CONFIDENCE");
  }

  const fatigue = buildFatigueSnapshot(apps, input.officialDate);
  const restBuckets = buildRestBuckets(apps);

  return {
    playerId: input.playerId,
    playerName: input.playerName,
    teamId: input.teamId,
    teamName: input.teamName,
    cutoffTime: input.cutoffTime,
    primaryRole: primary,
    secondaryRoles: secondary,
    roleScores,
    classificationStatus: status,
    inferredRole: primary,
    confidence,
    evidence,
    sampleSize,
    starterAppearancesExcluded: evidence.traditionalStarterExcluded,
    warnings,
    fatigue,
    restBuckets,
    engineEligible: false,
  };
}

export function selectCloserCandidate(
  pitchers: ClassifiedBullpenPitcher[],
): ClassifiedBullpenPitcher | null {
  const closers = pitchers
    .filter((p) => p.primaryRole === "CLOSER")
    .sort(
      (a, b) =>
        b.evidence.savesLast30 - a.evidence.savesLast30 ||
        (b.evidence.finishRate ?? 0) - (a.evidence.finishRate ?? 0),
    );
  return closers[0] ?? null;
}

export function groupByRole(
  pitchers: ClassifiedBullpenPitcher[],
  role: BullpenRole,
): ClassifiedBullpenPitcher[] {
  return pitchers
    .filter((p) => p.primaryRole === role)
    .sort((a, b) => a.playerId - b.playerId);
}
