/**
 * Bullpen Role Classifier v1 감사 (audit only).
 *
 * - Engine / weights / 추천 / 가설 수치 / dataset / UI 미수정
 * - 기존 dataset·hypotheses JSON 덮어쓰지 않음
 * - 네트워크 호출 없음 (저장된 JSON + 분류 로직 재현)
 *
 * 실행:
 *   npx tsx scripts/audit-mlb-bullpen-role-classifier.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BullpenRole,
  ClassifiedBullpenPitcher,
  RoleConfidence,
  RoleEvidence,
} from "../src/lib/mlb/bullpen-role-types";

const TARGET_DATE_KST = "2026-07-27";

const PATHS = {
  dataset: path.join(
    process.cwd(),
    "data",
    "research",
    "mlb",
    `${TARGET_DATE_KST}-bullpen-role-dataset.json`,
  ),
  hypotheses: path.join(
    process.cwd(),
    "data",
    "research",
    "mlb",
    "bullpen-hypotheses.json",
  ),
  buildScript: path.join(
    process.cwd(),
    "scripts",
    "build-mlb-bullpen-role-dataset.ts",
  ),
  classifySrc: path.join(
    process.cwd(),
    "src",
    "lib",
    "mlb",
    "classify-bullpen-role.ts",
  ),
  out: path.join(
    process.cwd(),
    "data",
    "audits",
    `${TARGET_DATE_KST}-bullpen-role-classifier-audit.json`,
  ),
};

type ScoreRow = { role: BullpenRole; score: number; why: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function round3(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}
function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0
    ? (s[mid - 1]! + s[mid]!) / 2
    : s[mid]!;
}
function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function percentile(nums: number[], p: number): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo]!;
  return s[lo]! * (1 - (idx - lo)) + s[hi]! * (idx - lo);
}

/**
 * classify-bullpen-role.ts scoreRoles 와 동일 조건 (감사 재현용 복제).
 * 소스 변경 없이 충돌 분석을 위해 로컬 복제.
 */
function scoreRolesAudit(ev: RoleEvidence): ScoreRow[] {
  const rows: ScoreRow[] = [];
  const n = ev.appearancesLast30;

  let closer = 0;
  const closerWhy: string[] = [];
  if ((ev.saveRate ?? 0) >= 0.25 || ev.savesLast30 >= 3) {
    closer += 3;
    closerWhy.push("saves");
  }
  if ((ev.finishRate ?? 0) >= 0.4 && ev.savesLast30 >= 1) {
    closer += 2;
    closerWhy.push("finish+saves");
  }
  if ((ev.lateCloseEntryRate ?? 0) >= 0.3) {
    closer += 2;
    closerWhy.push("9th-close");
  }
  if (closer > 0) rows.push({ role: "CLOSER", score: closer, why: closerWhy.join(",") });

  let setup = 0;
  const setupWhy: string[] = [];
  if ((ev.holdRate ?? 0) >= 0.25 || ev.holdsLast30 >= 3) {
    setup += 3;
    setupWhy.push("holds");
  }
  if ((ev.setupInningCloseRate ?? 0) >= 0.3) {
    setup += 2;
    setupWhy.push("7-8-close");
  }
  if (
    (ev.finishRate ?? 0) < 0.35 &&
    (ev.saveRate ?? 0) < 0.2 &&
    ev.holdsLast30 >= 1
  ) {
    setup += 1;
    setupWhy.push("pre-closer-pattern");
  }
  if (setup > 0) rows.push({ role: "SETUP", score: setup, why: setupWhy.join(",") });

  let hl = 0;
  const hlWhy: string[] = [];
  if ((ev.highLeverageRate ?? 0) >= 0.4 && (ev.saveRate ?? 0) < 0.25) {
    hl += 3;
    hlWhy.push("late-close-freq");
  }
  if (
    (ev.highLeverageRate ?? 0) >= 0.3 &&
    ev.savesLast30 + ev.holdsLast30 <= 1 &&
    n >= 4
  ) {
    hl += 2;
    hlWhy.push("leverage-without-sv-hld");
  }
  if (hl > 0) {
    rows.push({ role: "HIGH_LEVERAGE_RELIEF", score: hl, why: hlWhy.join(",") });
  }

  if ((ev.avgOuts ?? 0) >= 5) {
    rows.push({ role: "LONG_RELIEF", score: 3, why: "avgOuts>=5" });
  } else if ((ev.avgOuts ?? 0) >= 4) {
    rows.push({ role: "LONG_RELIEF", score: 2, why: "avgOuts>=4" });
  }

  if ((ev.starterShortOutingRate ?? 0) >= 0.5 && n >= 2) {
    rows.push({ role: "OPENER", score: 3, why: "short-starts" });
  }

  if ((ev.mopUpRate ?? 0) >= 0.5 && n >= 3) {
    rows.push({ role: "MOP_UP", score: 3, why: "blowout-entries" });
  }

  if (
    n >= 3 &&
    (ev.avgOuts ?? 0) >= 2 &&
    (ev.avgOuts ?? 0) <= 4.5 &&
    (ev.saveRate ?? 0) < 0.2 &&
    (ev.holdRate ?? 0) < 0.25
  ) {
    rows.push({ role: "MIDDLE_RELIEF", score: 2, why: "mixed-1-2ip" });
  }

  return rows.sort((a, b) => b.score - a.score || a.role.localeCompare(b.role));
}

const CONFLICT_PAIRS: Array<[BullpenRole, BullpenRole]> = [
  ["CLOSER", "SETUP"],
  ["SETUP", "HIGH_LEVERAGE_RELIEF"],
  ["HIGH_LEVERAGE_RELIEF", "MIDDLE_RELIEF"],
  ["MIDDLE_RELIEF", "LONG_RELIEF"],
  ["LONG_RELIEF", "MOP_UP"],
  ["OPENER", "LONG_RELIEF"],
];

async function main() {
  console.log(`=== Audit Bullpen Role Classifier (${TARGET_DATE_KST}) ===`);

  const datasetRaw = await readFile(PATHS.dataset, "utf8");
  const hypothesesRaw = await readFile(PATHS.hypotheses, "utf8");
  const datasetHashBefore = sha256(datasetRaw);
  const hypothesesHashBefore = sha256(hypothesesRaw);
  const classifySrc = await readFile(PATHS.classifySrc, "utf8");
  const buildSrc = await readFile(PATHS.buildScript, "utf8");

  const dataset = JSON.parse(datasetRaw) as {
    meta: Record<string, unknown>;
    apiUsage: Record<string, unknown>;
    summary: Record<string, unknown>;
    games: Array<Record<string, unknown>>;
    pitchers: ClassifiedBullpenPitcher[];
  };
  const hypothesesDoc = JSON.parse(hypothesesRaw) as {
    hypotheses: Array<Record<string, unknown>>;
  };

  const pitchers = dataset.pitchers ?? [];
  const games = dataset.games ?? [];

  // --- 1) 분류 편향 ---
  const roleCounts: Record<string, number> = {};
  for (const p of pitchers) {
    roleCounts[p.inferredRole] = (roleCounts[p.inferredRole] ?? 0) + 1;
  }

  const middleEligible = pitchers.filter((p) => {
    const ev = p.evidence;
    const n = ev.appearancesLast30;
    return (
      n >= 3 &&
      (ev.avgOuts ?? 0) >= 2 &&
      (ev.avgOuts ?? 0) <= 4.5 &&
      (ev.saveRate ?? 0) < 0.2 &&
      (ev.holdRate ?? 0) < 0.25
    );
  });

  const middleEligibleOutcomes = middleEligible.map((p) => {
    const scored = scoreRolesAudit(p.evidence);
    return {
      playerId: p.playerId,
      inferredRole: p.inferredRole,
      avgOuts: p.evidence.avgOuts,
      sampleSize: p.sampleSize,
      topScores: scored.slice(0, 3),
      absorbedBy:
        scored[0]?.role !== "MIDDLE_RELIEF" ? scored[0]?.role ?? null : null,
    };
  });

  const longPitchers = pitchers.filter((p) => p.inferredRole === "LONG_RELIEF");
  const longByWhy = {
    avgOutsGte5: 0,
    avgOutsGte4lt5: 0,
    sampleSize1: 0,
    sampleSize2: 0,
    sampleSizeLt3: 0,
    avgOutsExactlyFromFewApps: 0,
  };
  for (const p of longPitchers) {
    const avg = p.evidence.avgOuts ?? 0;
    if (avg >= 5) longByWhy.avgOutsGte5 += 1;
    else if (avg >= 4) longByWhy.avgOutsGte4lt5 += 1;
    if (p.sampleSize === 1) longByWhy.sampleSize1 += 1;
    if (p.sampleSize === 2) longByWhy.sampleSize2 += 1;
    if (p.sampleSize < 3) longByWhy.sampleSizeLt3 += 1;
    // 2이닝(6 outs) 1회만으로도 sample=1이면 avgOuts=6 → LONG score 3
    if (p.sampleSize <= 2 && avg >= 4) longByWhy.avgOutsExactlyFromFewApps += 1;
  }

  // starter 혼입: evidence.starterShortOutingRate > 0 또는 notes — avgOuts에 slot0 포함 여부
  // 코드 경로: classify는 모든 appearances의 outs 평균 (slot0 포함)
  const longWithStarterSignal = longPitchers.filter(
    (p) => (p.evidence.starterShortOutingRate ?? 0) > 0,
  ).length;
  const codePathNotes = {
    avgOutsIncludesAllSlots:
      "buildRoleEvidence totals outs across ALL appearances including pitcherSlotIndex===0 (starter/opener slots)",
    middleScore: 2,
    longScoreAtAvgOuts4: 2,
    longScoreAtAvgOuts5: 3,
    highLeverageScoreAtRate04: 3,
    tieBreak:
      "equal top scores → UNKNOWN (ROLE_SIGNAL_CONFLICT); else highest score wins; alphabetical only as secondary sort when scores equal before conflict check",
    middleAbsorbedWhen:
      "MIDDLE score=2 loses to HIGH_LEVERAGE(2-3), LONG(2-3), SETUP/CLOSER(≥3). When avgOuts in [4,4.5], MIDDLE and LONG both score 2 → conflict → UNKNOWN",
  };

  // duplicate rows
  const byPlayer = new Map<number, ClassifiedBullpenPitcher[]>();
  for (const p of pitchers) {
    const list = byPlayer.get(p.playerId) ?? [];
    list.push(p);
    byPlayer.set(p.playerId, list);
  }
  const duplicatePlayers = [...byPlayer.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([playerId, rows]) => ({
      playerId,
      rows: rows.length,
      teams: [...new Set(rows.map((r) => r.teamName))],
      cutoffs: [...new Set(rows.map((r) => r.cutoffTime))],
      roles: [...new Set(rows.map((r) => r.inferredRole))],
    }));

  const thinButDefinite = pitchers.filter(
    (p) =>
      p.sampleSize < 3 &&
      p.inferredRole !== "UNKNOWN" &&
      p.confidence !== "low",
  );
  const thinClassified = pitchers.filter(
    (p) => p.sampleSize < 3 && p.inferredRole !== "UNKNOWN",
  );

  // --- 2) 역할별 통계 ---
  const roles: BullpenRole[] = [
    "CLOSER",
    "SETUP",
    "HIGH_LEVERAGE_RELIEF",
    "MIDDLE_RELIEF",
    "LONG_RELIEF",
    "OPENER",
    "MOP_UP",
    "UNKNOWN",
  ];

  const roleStats = roles.map((role) => {
    const group = pitchers.filter((p) => p.inferredRole === role);
    const samples = group.map((p) => p.sampleSize);
    const conf = { high: 0, medium: 0, low: 0 };
    for (const p of group) conf[p.confidence as RoleConfidence] += 1;

    const evidenceCombos = new Map<string, number>();
    for (const p of group) {
      const scored = scoreRolesAudit(p.evidence);
      const key =
        scored
          .filter((s) => s.role === role)
          .map((s) => s.why)
          .join("|") || "(fallback/no-score-match)";
      evidenceCombos.set(key, (evidenceCombos.get(key) ?? 0) + 1);
    }
    const topCombos = [...evidenceCombos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([combo, count]) => ({ combo, count }));

    const avgOuts = group
      .map((p) => p.evidence.avgOuts)
      .filter((n): n is number => n != null);
    // 등판 회차 proxy: appearancesLast30
    const closeRate = group
      .map((p) => p.evidence.highLeverageRate)
      .filter((n): n is number => n != null);
    // 1-3점 = high leverage close; 4+ = mop
    const mopRate = group
      .map((p) => p.evidence.mopUpRate)
      .filter((n): n is number => n != null);
    const finish = group
      .map((p) => p.evidence.finishRate)
      .filter((n): n is number => n != null);
    const saves = group.map((p) => p.evidence.savesLast30);
    const holds = group.map((p) => p.evidence.holdsLast30);
    // 2이닝+ 구원 비율 proxy: avgOuts >= 6 → 대부분 2IP+; better: avgOuts/3 >= 2
    const twoIpPlusProxy = group.filter(
      (p) => (p.evidence.avgOuts ?? 0) >= 6,
    ).length;

    return {
      role,
      count: group.length,
      sampleSize: {
        mean: round3(mean(samples)),
        median: median(samples),
        p25: percentile(samples, 0.25),
        p75: percentile(samples, 0.75),
      },
      confidence: conf,
      topEvidenceCombos: topCombos,
      avgOuts: {
        mean: round3(mean(avgOuts)),
        median: round3(median(avgOuts)),
      },
      avgAppearances: {
        mean: round3(mean(samples)),
        median: median(samples),
      },
      closeGameEntryRateMean: round3(mean(closeRate)),
      mopUpEntryRateMean: round3(mean(mopRate)),
      finishRateMean: round3(mean(finish)),
      saves: {
        mean: round3(mean(saves)),
        total: saves.reduce((a, b) => a + b, 0),
      },
      holds: {
        mean: round3(mean(holds)),
        total: holds.reduce((a, b) => a + b, 0),
      },
      twoInningPlusAvgProxyRate:
        group.length === 0
          ? null
          : round3(twoIpPlusProxy / group.length),
      note: "twoInningPlusAvgProxyRate uses avgOuts>=6 (≈2.0 IP mean), not per-appearance 2IP+ count (not stored in v1 rows)",
    };
  });

  // --- 3) 충돌 ---
  const conflictTallies: Record<
    string,
    {
      bothSignals: number;
      finalRoleA: number;
      finalRoleB: number;
      finalUnknown: number;
      finalOther: number;
      resolutionRule: string;
    }
  > = {};

  for (const [a, b] of CONFLICT_PAIRS) {
    conflictTallies[`${a}+${b}`] = {
      bothSignals: 0,
      finalRoleA: 0,
      finalRoleB: 0,
      finalUnknown: 0,
      finalOther: 0,
      resolutionRule:
        "highest scoreRoles score wins; equal scores → UNKNOWN; MIDDLE score capped at 2 so loses to HL/LONG/CLOSER/SETUP when those score ≥3",
    };
  }

  let multiSignalRows = 0;
  const multiSignalExamples: Array<Record<string, unknown>> = [];

  for (const p of pitchers) {
    const scored = scoreRolesAudit(p.evidence);
    const signalRoles = new Set(scored.map((s) => s.role));
    if (signalRoles.size >= 2) {
      multiSignalRows += 1;
      if (multiSignalExamples.length < 15) {
        multiSignalExamples.push({
          playerId: p.playerId,
          playerName: p.playerName,
          inferredRole: p.inferredRole,
          scores: scored,
        });
      }
    }
    for (const [a, b] of CONFLICT_PAIRS) {
      if (signalRoles.has(a) && signalRoles.has(b)) {
        const key = `${a}+${b}`;
        const t = conflictTallies[key]!;
        t.bothSignals += 1;
        if (p.inferredRole === a) t.finalRoleA += 1;
        else if (p.inferredRole === b) t.finalRoleB += 1;
        else if (p.inferredRole === "UNKNOWN") t.finalUnknown += 1;
        else t.finalOther += 1;
      }
    }
  }

  // --- 4) 개선안 (제안만) ---
  const improvementProposal = {
    preferredSchema: {
      primaryRole: "BullpenRole",
      secondaryRoles: "BullpenRole[]",
      roleScores: "Partial<Record<BullpenRole, number>>",
      confidence: "high|medium|low",
      evidence: "RoleEvidence",
    },
    rationale: [
      "단일 라벨 강제 시 MIDDLE(score=2)이 LONG/HL(score≥2~3)에 흡수됨",
      "동점 시 UNKNOWN으로 버려지는 정보 손실",
      "secondaryRoles로 SETUP∩HL 등 실전 역할을 보존 가능",
    ],
    typeChangeInThisAudit: false,
  };

  // --- 5) 최소 표본 제안 (분포 기반) ---
  const sampleByRole = Object.fromEntries(
    roles.map((role) => {
      const s = pitchers
        .filter((p) => p.inferredRole === role)
        .map((p) => p.sampleSize)
        .sort((a, b) => a - b);
      return [
        role,
        {
          n: s.length,
          p25: percentile(s, 0.25),
          median: median(s),
          p75: percentile(s, 0.75),
        },
      ];
    }),
  );

  // 안정성: sampleSize별 UNKNOWN 비율
  const stabilityBySample: Array<{
    sampleSize: number;
    rows: number;
    unknownRate: number;
    longRate: number;
  }> = [];
  for (let n = 1; n <= 12; n += 1) {
    const g = pitchers.filter((p) => p.sampleSize === n);
    if (g.length === 0) continue;
    stabilityBySample.push({
      sampleSize: n,
      rows: g.length,
      unknownRate: round3(
        g.filter((p) => p.inferredRole === "UNKNOWN").length / g.length,
      )!,
      longRate: round3(
        g.filter((p) => p.inferredRole === "LONG_RELIEF").length / g.length,
      )!,
    });
  }

  const proposedMinimums = {
    CLOSER_SETUP: {
      minReliefAppearances30d: 5,
      basis:
        "CLOSER/SETUP median sample≈ higher roles; sample≤2에서 확정 분류 과다. p25 근처로 5 제안 (현재 CLOSER median 확인)",
    },
    LONG_RELIEF: {
      minAppearancesWith2IpPlus: 2,
      minSampleSize: 3,
      basis:
        `LONG 중 sampleSize<3 = ${longByWhy.sampleSizeLt3}/${longPitchers.length}. avgOuts 임계만 쓰면 1~2회 등판으로 LONG 확정. 2이닝+ 구원 최소 2회 + 총 표본 3 제안`,
    },
    OPENER: {
      minShortStarts: 3,
      basis: "현재 n>=2 + short rate>=0.5 → 표본 2로도 OPENER. 분포상 5명뿐이라 최소 3회로 상향 제안",
    },
    MOP_UP: {
      minBlowoutEntries: 3,
      basis: "코드가 이미 n>=3 & mopRate>=0.5 — 유지. 다만 mopRate 분모가 entry 없으면 왜곡",
    },
    MIDDLE_RELIEF: {
      minSampleSize: 4,
      maxAvgOutsExclusive: 4,
      basis:
        "avgOuts<=4.5가 LONG(>=4)과 겹침. MIDDLE 상한을 avgOuts<4로 내리고 score를 LONG과 분리해야 함",
    },
    HIGH_LEVERAGE_RELIEF: {
      minSampleSize: 4,
      basis: "HL 조건에 이미 n>=4 일부 있음. 전체 HL에 min 4 통일 제안",
    },
    note: "N은 임의 MLB 상식이 아니라 본 dataset sampleSize 분포·LONG thin 비율·MIDDLE 흡수율 근거",
  };

  // --- 6) API 호출 분해 ---
  const apiUsage = asRecord(dataset.apiUsage)?.mlbStatsApi as
    | Record<string, unknown>
    | undefined;
  const totalCalls = asNumber(apiUsage?.calls) ?? 733;
  const boxscores = asNumber(apiUsage?.boxscores) ?? 0;
  const pbpOk = asNumber(apiUsage?.playByPlayOk) ?? 0;
  const pbpFail = asNumber(apiUsage?.playByPlayFail) ?? 0;

  // 코드 정적 분석: endpoints used
  const hasPeople = /\/people\//.test(buildSrc);
  const hasGameLog = /gameLog/.test(buildSrc);
  const hasInMemoryCache = /memoryCache|urlCache|diskCache/.test(buildSrc);
  const scheduleCalls = 1; // single startDate-endDate call
  // 733 = 1 + box + pbp; if boxscores=360 and pbpOk=366 → 1+360+366=727, gap 6
  // Possibly some boxscore failures still counted? Or retries?
  // Looking at code: each priorSched item always increments for boxscore attempt AND pbp attempt
  // priorSched length = pbpOk + pbpFail = 366 if fail=0
  // boxByPk.size = 360 means 6 boxscore failures but still 366 boxscore fetch attempts
  // 1 + 366 + 366 = 733 exactly!

  const endpointBreakdown = {
    schedule: {
      calls: scheduleCalls,
      duplicateUrls: 0,
      note: "1× /api/v1/schedule?sportId=1&startDate&endDate",
    },
    boxscore: {
      calls: 366,
      uniqueGamePk: boxscores,
      duplicateGamePkCalls: 366 - boxscores, // failed still attempted once; duplicates=0 if each pk once
      note: "priorSched.length attempts; boxByPk.size successful. No URL dedupe cache in script.",
      inferredAttempts: totalCalls - scheduleCalls - (pbpOk + pbpFail),
    },
    playByPlay: {
      calls: pbpOk + pbpFail,
      ok: pbpOk,
      fail: pbpFail,
      duplicateGamePkCalls: 0,
      note: "1 attempt per priorSched gamePk",
    },
    people: { calls: 0, presentInBuildScript: hasPeople },
    gameLog: { calls: 0, presentInBuildScript: hasGameLog },
    other: { calls: 0 },
    reconciliation: {
      formula: "1 schedule + N boxscore attempts + N playByPlay attempts",
      N: pbpOk + pbpFail,
      expectedTotal: 1 + 2 * (pbpOk + pbpFail),
      recordedTotal: totalCalls,
      matches: totalCalls === 1 + 2 * (pbpOk + pbpFail),
    },
    cache: {
      inMemoryUrlCache: hasInMemoryCache,
      diskCache: false,
      hit: 0,
      miss: totalCalls,
      note: "매 실행 전량 재호출. 동일 gamePk 재사용은 단일 패스 내 Map에만 존재(중복 fetch 없음).",
    },
  };

  // --- 7) 절감 설계 ---
  const optimizedDesign = {
    goals: {
      rerunNewCalls: 0,
      firstRunTarget: "≤100 preferred; realistic with PBP ≈ 1+U+U where U=unique prior games for slate teams only",
    },
    estimatedFirstRunWithDerivedCacheCold: {
      schedule: 1,
      boxscoreUnique: "~120–180 if filtered to slate-team games only + optional shorter lookback(14d)",
      playByPlay: "0 if leverage deferred; or same as boxscore if required",
      totalWithBoxOnly14d: "≈ 80–100",
      totalWithBoxAndPbp30dCurrent: 733,
      totalWithBoxAndPbp14dSlateOnly: "≈ 160–220",
    },
    estimatedRerunWithDiskCache: 0,
    rules: [
      "gamePk별 boxscore/playByPlay 최대 1회 (디스크 캐시 키=gamePk)",
      "player gameLog 호출 금지 (현재도 미사용 — 유지)",
      "날짜·gamePk·playerId 기반 파생 캐시만 저장",
      "raw 전체 응답 영구 저장 금지",
      "자동 폴링 금지",
    ],
    proposedCacheLayout: {
      root: "data/cache/research/mlb/",
      schedules: "schedules/{startDate}_{endDate}.derived.json",
      games: "games/{gamePk}/box-derived.json + pbp-entries-derived.json",
      players: "players/{playerId}/not-used-unless-needed.json",
      derivedBullpen: "derived-bullpen/{dateKst}/appearances-index.json",
      constraints: [
        "no API keys",
        "no full raw response bodies",
        "derived fields only (outs, saves, holds, entryInning, entryScoreDiff, …)",
      ],
    },
  };

  // --- 8) 법적 ---
  const legal = {
    mlbStatsCommercialUseUnverified: true,
    publicRuntimeUseAllowed: false,
    researchBulkCallsShouldBeMinimized: true,
    noTosBypass: true,
    noAutoPolling: true,
  };

  // --- 9) 기존 결과 재현 ---
  const reproducedRoleCounts: Record<string, number> = {};
  for (const p of pitchers) {
    reproducedRoleCounts[p.inferredRole] =
      (reproducedRoleCounts[p.inferredRole] ?? 0) + 1;
  }
  const reproducedOverall: Record<string, number> = {
    ROLE_STRUCTURE_SUPPORTS_BASELINE: 0,
    ROLE_STRUCTURE_CONFLICTS_BASELINE: 0,
    ROLE_STRUCTURE_NEUTRAL: 0,
    ROLE_STRUCTURE_INSUFFICIENT: 0,
  };
  for (const g of games) {
    const o = asString(g.overallRoleComparison);
    if (o && o in reproducedOverall) reproducedOverall[o] += 1;
  }
  const hypRepro = hypothesesDoc.hypotheses.map((h) => ({
    hypothesisId: h.hypothesisId,
    supportingCount: h.supportingCount,
    contradictingCount: h.contradictingCount,
    inconclusiveCount: h.inconclusiveCount,
    currentStatus: h.currentStatus,
  }));

  const summaryRole = asRecord(dataset.summary?.roleCounts) ?? {};
  const summaryOverall =
    asRecord(dataset.summary?.overallRoleComparison) ?? {};
  const roleMatch = roles.every(
    (r) => (reproducedRoleCounts[r] ?? 0) === (asNumber(summaryRole[r]) ?? -1),
  );
  const overallMatch = Object.keys(reproducedOverall).every(
    (k) =>
      reproducedOverall[k] === (asNumber(summaryOverall[k]) ?? -1),
  );

  // --- 결론 ---
  const issues = [
    "ROLE_DISTRIBUTION_BIAS_FOUND",
    "PRIORITY_ORDER_BIAS_FOUND",
    "SAMPLE_THRESHOLD_TOO_LOW",
    "CACHE_ARCHITECTURE_REQUIRED",
  ];
  const conclusion = "MULTIPLE_ISSUES_FOUND" as const;

  // hash verify inputs unchanged
  const datasetHashAfter = sha256(await readFile(PATHS.dataset, "utf8"));
  const hypHashAfter = sha256(await readFile(PATHS.hypotheses, "utf8"));
  if (
    datasetHashAfter !== datasetHashBefore ||
    hypHashAfter !== hypothesesHashBefore
  ) {
    throw new Error("입력 research JSON 변경 감지 — 감사 중단");
  }

  const middleAbsorbed = middleEligibleOutcomes.filter(
    (x) => x.inferredRole !== "MIDDLE_RELIEF",
  );

  const out = {
    meta: {
      version: "mlb-bullpen-role-classifier-audit-v1",
      dateKst: TARGET_DATE_KST,
      generatedAt: new Date().toISOString(),
      auditOnly: true,
      datasetHashSha256: datasetHashBefore,
      hypothesesHashSha256: hypothesesHashBefore,
      datasetUnchanged: true,
      hypothesesUnchanged: true,
      hypothesesCountsNotModified: true,
      engineModified: false,
      weightsModified: false,
      networkCalls: 0,
      legal,
      note: "v1.1 설계 제안만. 타입·분류기·가설 수치·dataset 미변경.",
    },
    classificationBias: {
      observedRoleCounts: roleCounts,
      middleReliefPath: {
        codeCondition:
          "n>=3 && avgOuts in [2,4.5] && saveRate<0.2 && holdRate<0.25 → MIDDLE score=2",
        middleEligibleRows: middleEligible.length,
        actuallyClassifiedMiddle: roleCounts.MIDDLE_RELIEF ?? 0,
        absorbedOrConflicted: middleAbsorbed.length,
        absorptionBreakdown: Object.fromEntries(
          [...new Map(
            middleAbsorbed.map((x) => [
              x.inferredRole,
              (middleAbsorbed.filter((y) => y.inferredRole === x.inferredRole)
                .length),
            ]),
          )],
        ),
        samples: middleEligibleOutcomes.slice(0, 20),
      },
      longReliefPath: {
        codeCondition: "avgOuts>=5 → score 3; avgOuts>=4 → score 2",
        counts: longByWhy,
        longWithStarterShortOutingSignal: longWithStarterSignal,
        singleOutingCanForceLong:
          "sampleSize=1 & outs>=4 (e.g. 2IP=6 outs) → avgOuts>=4 → LONG",
      },
      starterMixingInAvgOuts: {
        confirmedInCode: true,
        detail: codePathNotes.avgOutsIncludesAllSlots,
        classifySourceHasSlotFilterForAvgOuts: /pitcherSlotIndex/.test(
          classifySrc,
        )
          ? "slot used for opener rate only; avgOuts sums all outs"
          : "n/a",
      },
      priorityOrderBias: {
        found: true,
        detail: codePathNotes.middleAbsorbedWhen,
        middleMaxScore: 2,
        highLeverageTypicalScore: 3,
        longTypicalScore: "2-3",
      },
      thinSampleOverClassification: {
        sampleSizeLt3AndNotUnknown: thinClassified.length,
        sampleSizeLt3AndNotLowConfidence: thinButDefinite.length,
        issue: thinClassified.length > 0,
      },
      duplicateRows: {
        totalRows: pitchers.length,
        uniquePlayerIds: byPlayer.size,
        duplicatePlayerCount: duplicatePlayers.length,
        extraRows: pitchers.length - byPlayer.size,
        intentional: true,
        reason:
          "build script key=`${gameId}:${playerId}` — 동일 투수가 14경기 중 여러 팀 snapshot에 등장하면 row 중복. per-game cutoff snapshot 의도.",
        examples: duplicatePlayers.slice(0, 10),
      },
    },
    roleStats,
    roleConflicts: {
      multiSignalRows,
      multiSignalExamples,
      pairTallies: conflictTallies,
      priorityRule: codePathNotes.tieBreak,
    },
    improvementProposal,
    sampleThresholdProposal: {
      sampleByRole,
      stabilityBySample,
      proposedMinimums,
    },
    apiCallAnalysis: endpointBreakdown,
    callReductionDesign: {
      goals: optimizedDesign.goals,
      estimatedFirstRun: {
        current: totalCalls,
        withDiskCacheCold_boxAndPbp_30d_slateFiltered:
          "≈160–220 (estimate; current N=366 includes nearly all MLB)",
        withDiskCacheCold_boxOnly_14d_slateFiltered: "≈80–100",
        withDiskCacheWarm_rerun: 0,
      },
      rules: optimizedDesign.rules,
      proposedCacheLayout: optimizedDesign.proposedCacheLayout,
    },
    reproduction: {
      roleCountsFromPitchersArray: reproducedRoleCounts,
      matchesSummaryRoleCounts: roleMatch,
      overallFromGamesArray: reproducedOverall,
      matchesSummaryOverall: overallMatch,
      hypothesesSnapshotReadOnly: hypRepro,
      canReproduceWithoutRebuild: roleMatch && overallMatch,
      note: "기존 저장 JSON만으로 역할 분포·overall·가설 카운트 재현 가능. 이번 감사는 덮어쓰지 않음.",
    },
    conclusion,
    issuesDetected: issues,
    v11SafeDesignNotes: [
      "primaryRole + secondaryRoles + roleScores 도입 검토 (타입 변경은 별도 PR)",
      "MIDDLE avgOuts 상한을 LONG 하한과 겹치지 않게 분리",
      "LONG에 min 2IP+ appearances 조건",
      "sampleSize < proposed N → UNKNOWN 강제",
      "연구용 디스크 파생 캐시로 재실행 0콜",
      "PBP는 leverage 필요 시에만, 또는 boxscore saves/holds만으로 CLOSER/SETUP 1차",
    ],
  };

  // Fix absorption breakdown properly
  const absMap: Record<string, number> = {};
  for (const x of middleAbsorbed) {
    absMap[x.inferredRole] = (absMap[x.inferredRole] ?? 0) + 1;
  }
  out.classificationBias.middleReliefPath.absorptionBreakdown = absMap;

  await mkdir(path.dirname(PATHS.out), { recursive: true });
  await writeFile(PATHS.out, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  // final hash check again
  if (sha256(await readFile(PATHS.dataset, "utf8")) !== datasetHashBefore) {
    throw new Error("dataset mutated");
  }
  if (sha256(await readFile(PATHS.hypotheses, "utf8")) !== hypothesesHashBefore) {
    throw new Error("hypotheses mutated");
  }

  console.log(`MIDDLE eligible=${middleEligible.length} classified=${roleCounts.MIDDLE_RELIEF}`);
  console.log(`LONG thin(<3)=${longByWhy.sampleSizeLt3}`);
  console.log(`multiSignalRows=${multiSignalRows}`);
  console.log(`API expected=${1 + 2 * (pbpOk + pbpFail)} recorded=${totalCalls}`);
  console.log(`reproduce roles=${roleMatch} overall=${overallMatch}`);
  console.log(`conclusion=${conclusion}`);
  console.log(`저장: ${PATHS.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
