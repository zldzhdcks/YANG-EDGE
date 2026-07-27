/**
 * 팀 불펜 역할 snapshot · 경기 전 구조 비교.
 * 종합 가중 점수 없음. Engine 미연결.
 */
import type {
  BullpenRole,
  ClassifiedBullpenPitcher,
  GameBullpenRoleCompare,
  OverallRoleComparison,
  RoleGroupSnapshot,
  RoleRiskFlag,
  SideRoleCompare,
  TeamBullpenRoleSnapshot,
} from "./bullpen-role-types";
import {
  groupByRole,
  selectCloserCandidate,
} from "./classify-bullpen-role";

function round3(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function collect(
  pitchers: ClassifiedBullpenPitcher[],
  fn: (p: ClassifiedBullpenPitcher) => number | null,
): number[] {
  return pitchers
    .map(fn)
    .filter((n): n is number => n != null && Number.isFinite(n))
    .sort((a, b) => a - b);
}

export function computeUsageThresholds(
  pitchers: ClassifiedBullpenPitcher[],
): Record<string, { median: number | null; p75: number | null }> {
  const pitches3 = collect(pitchers, (p) => p.fatigue.pitchesLast3Days);
  const apps3 = collect(pitchers, (p) => p.fatigue.appearancesLast3Days);
  const inn3 = collect(pitchers, (p) => p.fatigue.inningsLast3Days);
  return {
    pitchesLast3Days: {
      median: round3(percentile(pitches3, 0.5)),
      p75: round3(percentile(pitches3, 0.75)),
    },
    appearancesLast3Days: {
      median: round3(percentile(apps3, 0.5)),
      p75: round3(percentile(apps3, 0.75)),
    },
    inningsLast3Days: {
      median: round3(percentile(inn3, 0.5)),
      p75: round3(percentile(inn3, 0.75)),
    },
  };
}

function buildGroup(
  role: BullpenRole,
  members: ClassifiedBullpenPitcher[],
): RoleGroupSnapshot {
  const rests = members
    .map((p) => p.fatigue.restDaysBeforeGame)
    .filter((n): n is number => n != null);
  const pitches = members
    .map((p) => p.fatigue.pitchesLast3Days)
    .filter((n): n is number => n != null);
  const innings = members
    .map((p) => p.fatigue.inningsLast3Days)
    .filter((n): n is number => n != null);

  return {
    role,
    playerIds: members.map((p) => p.playerId),
    availableCount: members.length, // 부상·말소 미확인 → 전원 availabilityUnknown
    usedPreviousDayCount: members.filter((p) => p.fatigue.usedPreviousDay)
      .length,
    backToBackCount: members.filter((p) => p.fatigue.usedBackToBack).length,
    possibleThirdDayCount: members.filter(
      (p) => p.fatigue.possibleThirdConsecutiveDay,
    ).length,
    pitchesLast3Days:
      pitches.length > 0 ? pitches.reduce((s, n) => s + n, 0) : null,
    inningsLast3Days:
      innings.length > 0
        ? round3(innings.reduce((s, n) => s + n, 0))
        : null,
    avgRestDays:
      rests.length > 0
        ? round3(rests.reduce((s, n) => s + n, 0) / rests.length)
        : null,
    unavailableOrHighRiskCount: members.filter(
      (p) =>
        p.fatigue.usedBackToBack ||
        p.fatigue.possibleThirdConsecutiveDay ||
        p.confidence === "low",
    ).length,
    availabilityUnknown: true,
  };
}

function geP75(value: number | null, p75: number | null): boolean {
  return value != null && p75 != null && value >= p75 && value > 0;
}

export function buildTeamBullpenRoleSnapshot(input: {
  teamId: number;
  teamName: string;
  cutoffTime: string;
  pitchers: ClassifiedBullpenPitcher[];
  /** 전체 표본 기준 임계값 (상대적 고사용) */
  thresholds: Record<string, { median: number | null; p75: number | null }>;
}): TeamBullpenRoleSnapshot {
  const pitchers = [...input.pitchers].sort(
    (a, b) => a.playerId - b.playerId,
  );
  // v1.1: groupByRole / selectCloser는 primaryRole 기준
  const closerCandidate = selectCloserCandidate(pitchers);
  const setupCandidates = groupByRole(pitchers, "SETUP");
  const highLeverageCandidates = groupByRole(
    pitchers,
    "HIGH_LEVERAGE_RELIEF",
  );
  const middleReliefCandidates = groupByRole(pitchers, "MIDDLE_RELIEF");
  const longReliefCandidates = groupByRole(pitchers, "LONG_RELIEF");
  const openerCandidates = groupByRole(pitchers, "OPENER");
  const mopUpCandidates = groupByRole(pitchers, "MOP_UP");
  const unknownRelievers = groupByRole(pitchers, "UNKNOWN");

  const groups: RoleGroupSnapshot[] = [
    buildGroup("CLOSER", closerCandidate ? [closerCandidate] : []),
    buildGroup("SETUP", setupCandidates),
    buildGroup("HIGH_LEVERAGE_RELIEF", highLeverageCandidates),
    buildGroup("MIDDLE_RELIEF", middleReliefCandidates),
    buildGroup("LONG_RELIEF", longReliefCandidates),
    buildGroup("OPENER", openerCandidates),
    buildGroup("MOP_UP", mopUpCandidates),
    buildGroup("UNKNOWN", unknownRelievers),
  ];

  const flags: RoleRiskFlag[] = [];
  const th = input.thresholds;

  if (!closerCandidate) {
    flags.push("CLOSER_STATUS_UNKNOWN");
  } else {
    if (closerCandidate.fatigue.usedPreviousDay) {
      flags.push("CLOSER_USED_PREVIOUS_DAY");
    }
    if (closerCandidate.fatigue.usedBackToBack) {
      flags.push("CLOSER_BACK_TO_BACK");
    }
    if (closerCandidate.fatigue.possibleThirdConsecutiveDay) {
      flags.push("CLOSER_THIRD_DAY_RISK");
    }
  }

  const setupPitches = setupCandidates.reduce(
    (s, p) => s + (p.fatigue.pitchesLast3Days ?? 0),
    0,
  );
  if (
    setupCandidates.length > 0 &&
    geP75(setupPitches, th.pitchesLast3Days?.p75 ?? null)
  ) {
    flags.push("SETUP_CORE_HEAVY_USAGE");
  }
  if (setupCandidates.some((p) => p.fatigue.usedBackToBack)) {
    flags.push("SETUP_CORE_BACK_TO_BACK");
  }

  const hlGroup = highLeverageCandidates;
  const hlFatigued =
    hlGroup.filter(
      (p) => p.fatigue.usedPreviousDay || p.fatigue.usedBackToBack,
    ).length >= Math.max(1, Math.ceil(hlGroup.length / 2)) &&
    hlGroup.length > 0;
  if (hlFatigued) flags.push("HIGH_LEVERAGE_GROUP_FATIGUED");

  if (middleReliefCandidates.length <= 1) {
    flags.push("MIDDLE_RELIEF_THIN");
  }

  if (
    longReliefCandidates.length === 0 ||
    longReliefCandidates.every((p) => p.fatigue.usedPreviousDay)
  ) {
    // “unavailable”은 부상 확인 시에만 — 여기선 전원 전날 사용 시에만 약한 신호
    if (
      longReliefCandidates.length > 0 &&
      longReliefCandidates.every((p) => p.fatigue.usedPreviousDay)
    ) {
      flags.push("LONG_RELIEF_UNAVAILABLE");
    }
  }

  const keyPitchers = [
    ...(closerCandidate ? [closerCandidate] : []),
    ...setupCandidates,
    ...highLeverageCandidates,
  ];
  const keyUsedPrev = keyPitchers.filter((p) => p.fatigue.usedPreviousDay);
  if (keyUsedPrev.length >= 2) {
    flags.push("MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY");
  }

  if (
    pitchers.filter((p) => p.confidence === "low").length >=
    Math.ceil(pitchers.length / 2)
  ) {
    flags.push("ROLE_CLASSIFICATION_LOW_CONFIDENCE");
  }
  if (pitchers.length === 0) flags.push("DATA_UNAVAILABLE");

  return {
    teamId: input.teamId,
    teamName: input.teamName,
    cutoffTime: input.cutoffTime,
    closerCandidate,
    setupCandidates,
    highLeverageCandidates,
    middleReliefCandidates,
    longReliefCandidates,
    openerCandidates,
    mopUpCandidates,
    unknownRelievers,
    groups,
    roleFlags: flags,
    thresholdsUsed: th,
  };
}

function keyFatigueCount(team: TeamBullpenRoleSnapshot): number {
  const keys = [
    "CLOSER_USED_PREVIOUS_DAY",
    "CLOSER_BACK_TO_BACK",
    "CLOSER_THIRD_DAY_RISK",
    "SETUP_CORE_HEAVY_USAGE",
    "SETUP_CORE_BACK_TO_BACK",
    "HIGH_LEVERAGE_GROUP_FATIGUED",
    "MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY",
  ] as RoleRiskFlag[];
  return team.roleFlags.filter((f) => keys.includes(f)).length;
}

function sideCompare(
  pick: TeamBullpenRoleSnapshot,
  opp: TeamBullpenRoleSnapshot,
  pickFlags: RoleRiskFlag[],
  oppFlags: RoleRiskFlag[],
  note: string,
): SideRoleCompare {
  return {
    pickRiskFlags: pickFlags,
    oppRiskFlags: oppFlags,
    pickKeyFatigueCount: pickFlags.length,
    oppKeyFatigueCount: oppFlags.length,
    note,
  };
}

export function compareGameBullpenRoles(input: {
  gameId: string;
  match: string;
  baselinePick: string;
  pickSide: "home" | "away";
  cutoffTime: string;
  pick: TeamBullpenRoleSnapshot;
  opp: TeamBullpenRoleSnapshot;
}): Omit<GameBullpenRoleCompare, "postGame"> {
  const { pick, opp } = input;

  const closerPick = pick.roleFlags.filter((f) =>
    f.startsWith("CLOSER_"),
  );
  const closerOpp = opp.roleFlags.filter((f) => f.startsWith("CLOSER_"));
  const setupPick = pick.roleFlags.filter((f) => f.startsWith("SETUP_"));
  const setupOpp = opp.roleFlags.filter((f) => f.startsWith("SETUP_"));
  const hlPick = pick.roleFlags.filter(
    (f) => f === "HIGH_LEVERAGE_GROUP_FATIGUED",
  );
  const hlOpp = opp.roleFlags.filter(
    (f) => f === "HIGH_LEVERAGE_GROUP_FATIGUED",
  );
  const midLongPick = pick.roleFlags.filter(
    (f) => f === "MIDDLE_RELIEF_THIN" || f === "LONG_RELIEF_UNAVAILABLE",
  );
  const midLongOpp = opp.roleFlags.filter(
    (f) => f === "MIDDLE_RELIEF_THIN" || f === "LONG_RELIEF_UNAVAILABLE",
  );

  const pickFatigue = keyFatigueCount(pick);
  const oppFatigue = keyFatigueCount(opp);

  let overall: OverallRoleComparison = "ROLE_STRUCTURE_NEUTRAL";
  if (
    pick.roleFlags.includes("DATA_UNAVAILABLE") ||
    opp.roleFlags.includes("DATA_UNAVAILABLE") ||
    (pick.roleFlags.includes("ROLE_CLASSIFICATION_LOW_CONFIDENCE") &&
      opp.roleFlags.includes("ROLE_CLASSIFICATION_LOW_CONFIDENCE") &&
      pickFatigue === 0 &&
      oppFatigue === 0)
  ) {
    overall = "ROLE_STRUCTURE_INSUFFICIENT";
  } else if (oppFatigue >= pickFatigue + 2) {
    overall = "ROLE_STRUCTURE_SUPPORTS_BASELINE";
  } else if (pickFatigue >= oppFatigue + 2) {
    overall = "ROLE_STRUCTURE_CONFLICTS_BASELINE";
  } else {
    overall = "ROLE_STRUCTURE_NEUTRAL";
  }

  return {
    gameId: input.gameId,
    match: input.match,
    baselinePick: input.baselinePick,
    pickSide: input.pickSide,
    cutoffTime: input.cutoffTime,
    pick,
    opp,
    closerCompare: sideCompare(
      pick,
      opp,
      closerPick,
      closerOpp,
      "closer fatigue flags only",
    ),
    setupCompare: sideCompare(
      pick,
      opp,
      setupPick,
      setupOpp,
      "setup fatigue flags only",
    ),
    highLeverageCompare: sideCompare(
      pick,
      opp,
      hlPick,
      hlOpp,
      "high leverage group fatigue",
    ),
    middleLongCompare: sideCompare(
      pick,
      opp,
      midLongPick,
      midLongOpp,
      "middle/long depth flags",
    ),
    overallRoleComparison: overall,
  };
}
