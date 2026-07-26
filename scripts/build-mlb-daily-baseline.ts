/**
 * 2026-07-28 KST MLB 12경기 — Baseline 일일 오케스트레이션.
 *
 * 기존 스크립트/순수 함수 재사용:
 *   - scripts/test-mlb-analysis-coverage.ts
 *   - scripts/run-mlb-baseline-analysis.ts
 *   - scripts/filter-mlb-betting-lines.ts
 *   - src/lib/mlb/betting-line-filter.ts
 *   - src/lib/mlb/build-mlb-watchlist.ts
 *   - data/plans/2026-07-28-mlb-purchase-plan.json
 *
 * EDGE Engine / weights / Confidence / 추천 등급 규칙 미변경.
 * 선발·라인업은 점수에 미반영. SportsDataIO Scrambled / Stats API 점수 반영 금지.
 * Prediction snapshot / 가계부 / UI 미연결.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/build-mlb-daily-baseline.ts
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildMlbWatchlistFile,
  type MlbWatchlistLineInput,
} from "../src/lib/mlb/build-mlb-watchlist";
import { normalizeTeamNameForOdds } from "../src/lib/odds";

const TARGET_DATE_KST = (
  process.env.MLB_TARGET_DATE_KST ?? "2026-07-28"
).trim();

const ROOT = process.cwd();
const COVERAGE_PATH = path.join(
  ROOT,
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-analysis-coverage.json`,
);
const BASELINE_PATH = path.join(
  ROOT,
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
);
const FILTER_PATH = path.join(
  ROOT,
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-betting-line-filter.json`,
);
const PLAN_PATH = path.join(
  ROOT,
  "data",
  "plans",
  `${TARGET_DATE_KST}-mlb-purchase-plan.json`,
);
const WATCHLIST_PATH = path.join(
  ROOT,
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb.json`,
);
const DAILY_SUMMARY_PATH = path.join(
  ROOT,
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-daily-baseline-summary.json`,
);

type DailyClass =
  | "DAILY_HIGH"
  | "DAILY_MEDIUM"
  | "DAILY_WATCH"
  | "DAILY_DROP";

type PurchasePlanGame = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  bucket: string;
  recommendedInitialAnalysisKst: string | null;
  recommendedOddsRefreshKst: string | null;
  recommendedFinalDecisionKst: string | null;
  officialCloseVerified: boolean;
  warnings: string[];
};

type FilterLine = {
  gameId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  pickTeam: string | null;
  pickTeamId: "home" | "away" | null;
  startTimeKst: string;
  dateKst: string;
  bestOdds: number | null;
  modelWinProbability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  edgeScore: number | null;
  confidence: number | null;
  dataAvailability: number | null;
  classification: string;
  warnings: string[];
  missingData: string[];
  reasons?: string[];
};

type BaselineGame = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string;
  analysisStatus: string;
  pickTeam: string | null;
  edgeScore: number | null;
  confidence: number | null;
  valueEdge: number | null;
  marketProbability: number | null;
  modelWinProbability: number | null;
  dataAvailability: number | null;
  missingFactors?: string[];
  warnings?: string[];
};

type DailyCandidate = FilterLine & {
  purchaseTimingClass: string;
  recommendedInitialAnalysisKst: string | null;
  recommendedOddsRefreshKst: string | null;
  recommendedFinalDecisionKst: string | null;
  officialCloseVerified: boolean;
  purchaseWarnings: string[];
  dailyClass: DailyClass;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function teamsEqual(a: string, b: string): boolean {
  const na = normalizeTeamNameForOdds(a);
  const nb = normalizeTeamNameForOdds(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return (
    na.length >= 4 &&
    nb.length >= 4 &&
    (na.includes(nb) || nb.includes(na))
  );
}

function runScript(scriptRel: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === "win32";
    const child = spawn(
      isWin ? "npx.cmd" : "npx",
      ["tsx", "--env-file=.env.local", scriptRel],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          MLB_TARGET_DATE_KST: TARGET_DATE_KST,
        },
        stdio: "inherit",
        shell: isWin,
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptRel} exit ${code}`));
    });
  });
}

function loadPurchasePlan(raw: unknown): Map<string, PurchasePlanGame> {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  const byKey = new Map<string, PurchasePlanGame>();
  for (const entry of games) {
    const row = asRecord(entry);
    if (!row) continue;
    const homeTeam = asString(row.homeTeam);
    const awayTeam = asString(row.awayTeam);
    if (!homeTeam || !awayTeam) continue;
    const game: PurchasePlanGame = {
      gameId: asString(row.gameId) ?? "",
      homeTeam,
      awayTeam,
      bucket: asString(row.bucket) ?? "UNKNOWN",
      recommendedInitialAnalysisKst: asString(
        row.recommendedInitialAnalysisKst,
      ),
      recommendedOddsRefreshKst: asString(row.recommendedOddsRefreshKst),
      recommendedFinalDecisionKst: asString(row.recommendedFinalDecisionKst),
      officialCloseVerified: row.officialCloseVerified === true,
      warnings: Array.isArray(row.warnings)
        ? row.warnings.filter((w): w is string => typeof w === "string")
        : [],
    };
    byKey.set(`${normalizeTeamNameForOdds(homeTeam)}|${normalizeTeamNameForOdds(awayTeam)}`, game);
  }
  return byKey;
}

function findPurchasePlan(
  map: Map<string, PurchasePlanGame>,
  homeTeam: string,
  awayTeam: string,
): PurchasePlanGame | null {
  const exact = map.get(
    `${normalizeTeamNameForOdds(homeTeam)}|${normalizeTeamNameForOdds(awayTeam)}`,
  );
  if (exact) return exact;
  for (const game of map.values()) {
    if (teamsEqual(game.homeTeam, homeTeam) && teamsEqual(game.awayTeam, awayTeam)) {
      return game;
    }
  }
  return null;
}

function classifyDaily(
  classification: string,
  valueEdge: number | null,
  purchaseBucket: string,
): DailyClass {
  if (purchaseBucket === "NO_PURCHASE_WINDOW") return "DAILY_DROP";
  if (classification === "MARKET_CONFLICT" || classification === "INSUFFICIENT") {
    return "DAILY_DROP";
  }
  if (classification === "REVIEW_SECONDARY") return "DAILY_WATCH";
  if (classification === "REVIEW_PRIORITY") {
    if (valueEdge != null && valueEdge >= 10) return "DAILY_HIGH";
    if (valueEdge != null && valueEdge > 0) return "DAILY_MEDIUM";
    return "DAILY_DROP";
  }
  return "DAILY_DROP";
}

function sortDaily(rows: DailyCandidate[]): DailyCandidate[] {
  const rank: Record<DailyClass, number> = {
    DAILY_HIGH: 0,
    DAILY_MEDIUM: 1,
    DAILY_WATCH: 2,
    DAILY_DROP: 3,
  };
  return [...rows].sort((a, b) => {
    const r = rank[a.dailyClass] - rank[b.dailyClass];
    if (r !== 0) return r;
    const t = (a.recommendedFinalDecisionKst ?? "").localeCompare(
      b.recommendedFinalDecisionKst ?? "",
    );
    if (t !== 0) return t;
    const ve =
      (b.valueEdge ?? Number.NEGATIVE_INFINITY) -
      (a.valueEdge ?? Number.NEGATIVE_INFINITY);
    if (ve !== 0) return ve;
    const edge =
      Math.abs(b.edgeScore ?? 0) - Math.abs(a.edgeScore ?? 0);
    if (edge !== 0) return edge;
    const conf =
      (b.confidence ?? Number.NEGATIVE_INFINITY) -
      (a.confidence ?? Number.NEGATIVE_INFINITY);
    if (conf !== 0) return conf;
    return a.gameId.localeCompare(b.gameId);
  });
}

function dailyToPriority(
  daily: DailyClass,
): "HIGH" | "MEDIUM" | "WATCH" | null {
  if (daily === "DAILY_HIGH") return "HIGH";
  if (daily === "DAILY_MEDIUM") return "MEDIUM";
  if (daily === "DAILY_WATCH") return "WATCH";
  return null;
}

async function main() {
  console.log(`=== MLB Daily Baseline (${TARGET_DATE_KST} KST) ===`);
  console.log("Engine/weights 미변경. 선발·라인업 점수 미반영. 스냅샷 미저장.\n");

  const planRaw = JSON.parse(await readFile(PLAN_PATH, "utf8"));
  const purchaseMap = loadPurchasePlan(planRaw);

  console.log("1/3 Analysis coverage…");
  await runScript("scripts/test-mlb-analysis-coverage.ts");
  console.log("\n2/3 Baseline analysis…");
  await runScript("scripts/run-mlb-baseline-analysis.ts");
  console.log("\n3/3 Betting line filter…");
  await runScript("scripts/filter-mlb-betting-lines.ts");

  const coverage = JSON.parse(await readFile(COVERAGE_PATH, "utf8"));
  const baseline = JSON.parse(await readFile(BASELINE_PATH, "utf8"));
  const filter = JSON.parse(await readFile(FILTER_PATH, "utf8"));

  const baselineGames: BaselineGame[] = Array.isArray(baseline.games)
    ? baseline.games.map((entry: unknown) => {
        const row = asRecord(entry) ?? {};
        return {
          gameId: asString(row.gameId) ?? "",
          homeTeam: asString(row.homeTeam) ?? "",
          awayTeam: asString(row.awayTeam) ?? "",
          startTimeKst: asString(row.startTimeKst) ?? "",
          analysisStatus: asString(row.analysisStatus) ?? "",
          pickTeam: asString(row.pickTeam),
          edgeScore: asNumber(row.edgeScore),
          confidence: asNumber(row.confidence),
          valueEdge: asNumber(row.valueEdge),
          marketProbability: asNumber(row.marketProbability),
          modelWinProbability: asNumber(row.modelWinProbability),
          dataAvailability: asNumber(row.dataAvailability),
          missingFactors: Array.isArray(row.missingFactors)
            ? row.missingFactors.filter((x): x is string => typeof x === "string")
            : [],
          warnings: Array.isArray(row.warnings)
            ? row.warnings.filter((x): x is string => typeof x === "string")
            : [],
        };
      })
    : [];

  const filterLines: FilterLine[] = Array.isArray(filter.lines)
    ? filter.lines.map((entry: unknown) => {
        const row = asRecord(entry) ?? {};
        return {
          gameId: asString(row.gameId) ?? "",
          match: asString(row.match) ?? "",
          homeTeam: asString(row.homeTeam) ?? "",
          awayTeam: asString(row.awayTeam) ?? "",
          pickTeam: asString(row.pickTeam),
          pickTeamId:
            asString(row.pickTeamId) === "home" ||
            asString(row.pickTeamId) === "away"
              ? (asString(row.pickTeamId) as "home" | "away")
              : null,
          startTimeKst: asString(row.startTimeKst) ?? "",
          dateKst: asString(row.dateKst) ?? TARGET_DATE_KST,
          bestOdds: asNumber(row.bestOdds),
          modelWinProbability: asNumber(row.modelWinProbability),
          marketProbability: asNumber(row.marketProbability),
          valueEdge: asNumber(row.valueEdge),
          edgeScore: asNumber(row.edgeScore),
          confidence: asNumber(row.confidence),
          dataAvailability: asNumber(row.dataAvailability),
          classification: asString(row.classification) ?? "INSUFFICIENT",
          warnings: Array.isArray(row.warnings)
            ? row.warnings.filter((x): x is string => typeof x === "string")
            : [],
          missingData: Array.isArray(row.missingData)
            ? row.missingData.filter((x): x is string => typeof x === "string")
            : [],
          reasons: Array.isArray(row.reasons)
            ? row.reasons.filter((x): x is string => typeof x === "string")
            : [],
        };
      })
    : [];

  // PASS/INSUFFICIENT 경기도 DAILY_DROP 집계를 위해 baseline에서 보완
  const filterById = new Set(filterLines.map((l) => l.gameId));
  const syntheticDrops: FilterLine[] = baselineGames
    .filter((g) => g.gameId && !filterById.has(g.gameId))
    .map((g) => ({
      gameId: g.gameId,
      match: `${g.homeTeam} vs ${g.awayTeam}`,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      pickTeam: g.pickTeam,
      pickTeamId: null,
      startTimeKst: g.startTimeKst,
      dateKst: TARGET_DATE_KST,
      bestOdds: null,
      modelWinProbability: g.modelWinProbability,
      marketProbability: g.marketProbability,
      valueEdge: g.valueEdge,
      edgeScore: g.edgeScore,
      confidence: g.confidence,
      dataAvailability: g.dataAvailability,
      classification:
        g.analysisStatus === "INSUFFICIENT_DATA"
          ? "INSUFFICIENT"
          : "INSUFFICIENT",
      warnings: g.warnings ?? [],
      missingData: g.missingFactors ?? [],
      reasons: [`baseline ${g.analysisStatus}`],
    }));

  const allLines = [...filterLines, ...syntheticDrops];

  const daily: DailyCandidate[] = allLines.map((line) => {
    const plan = findPurchasePlan(purchaseMap, line.homeTeam, line.awayTeam);
    const purchaseTimingClass = plan?.bucket ?? "UNKNOWN";
    const dailyClass = classifyDaily(
      line.classification,
      line.valueEdge,
      purchaseTimingClass,
    );
    return {
      ...line,
      purchaseTimingClass,
      recommendedInitialAnalysisKst:
        plan?.recommendedInitialAnalysisKst ?? null,
      recommendedOddsRefreshKst: plan?.recommendedOddsRefreshKst ?? null,
      recommendedFinalDecisionKst:
        plan?.recommendedFinalDecisionKst ?? null,
      officialCloseVerified: plan?.officialCloseVerified ?? false,
      purchaseWarnings: plan?.warnings ?? ["PURCHASE_PLAN_UNMATCHED"],
      dailyClass,
    };
  });

  const sorted = sortDaily(daily);
  const fingerprint = () =>
    JSON.stringify(
      sorted.map((g) => ({
        gameId: g.gameId,
        dailyClass: g.dailyClass,
        classification: g.classification,
        valueEdge: g.valueEdge,
        edgeScore: g.edgeScore,
        confidence: g.confidence,
        finalDecision: g.recommendedFinalDecisionKst,
      })),
    );
  const deterministic = fingerprint() === fingerprint();

  // enrich filter file with purchase + daily fields (원본 lines 유지 + dailyCandidates)
  const enrichedFilter = {
    ...filter,
    meta: {
      ...(asRecord(filter.meta) ?? {}),
      dailyBaselineOrchestrated: true,
      purchasePlan: path.relative(ROOT, PLAN_PATH).replace(/\\/g, "/"),
      orchestratedAt: new Date().toISOString(),
    },
    dailyCandidates: sorted,
    dailySummary: {
      DAILY_HIGH: sorted.filter((g) => g.dailyClass === "DAILY_HIGH").length,
      DAILY_MEDIUM: sorted.filter((g) => g.dailyClass === "DAILY_MEDIUM").length,
      DAILY_WATCH: sorted.filter((g) => g.dailyClass === "DAILY_WATCH").length,
      DAILY_DROP: sorted.filter((g) => g.dailyClass === "DAILY_DROP").length,
    },
  };
  await writeFile(
    FILTER_PATH,
    `${JSON.stringify(enrichedFilter, null, 2)}\n`,
    "utf8",
  );

  // Watchlist: HIGH/MEDIUM/WATCH only (DAILY_DROP 제외)
  const watchInputs: MlbWatchlistLineInput[] = sorted
    .filter((g) => dailyToPriority(g.dailyClass) != null)
    .map((g) => ({
      gameId: g.gameId,
      startTimeKst: g.startTimeKst,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      pickTeam: g.pickTeam,
      bestOdds: g.bestOdds,
      modelWinProbability: g.modelWinProbability,
      marketProbability: g.marketProbability,
      valueEdge: g.valueEdge,
      edgeScore: g.edgeScore,
      confidence: g.confidence,
      dataAvailability: g.dataAvailability,
      // resolveWatchPriority는 REVIEW_* 기준 — DAILY 등급에 맞게 매핑
      classification:
        g.dailyClass === "DAILY_WATCH"
          ? "REVIEW_SECONDARY"
          : "REVIEW_PRIORITY",
      missingData: [
        ...g.missingData,
        ...(g.missingData.includes("선발투수") ? [] : ["선발투수"]),
      ],
      warnings: [
        ...g.warnings,
        ...g.purchaseWarnings,
        `dailyClass:${g.dailyClass}`,
        `purchaseTiming:${g.purchaseTimingClass}`,
      ],
    }));

  let existingWatchlist = null;
  try {
    existingWatchlist = JSON.parse(await readFile(WATCHLIST_PATH, "utf8"));
  } catch {
    /* none */
  }

  const createdAt = new Date().toISOString();
  const { file: watchFile, unchanged } = buildMlbWatchlistFile({
    targetDateKst: TARGET_DATE_KST,
    lines: watchInputs,
    createdAt,
    existing: existingWatchlist,
  });

  // attach purchase timing onto watchlist games
  const watchWithPurchase = {
    ...watchFile,
    meta: {
      ...watchFile.meta,
      purchasePlanAttached: true,
      baselineOnly: true,
      note:
        "Baseline 1차 관찰 후보. 선발·라인업·부상·최신 Odds 재확인 필요. 확정 추천 아님.",
    },
    games: watchFile.games.map((g) => {
      const dailyRow = sorted.find((d) => d.gameId === g.gameId);
      return {
        ...g,
        dailyClass: dailyRow?.dailyClass ?? null,
        purchaseTimingClass: dailyRow?.purchaseTimingClass ?? null,
        recommendedInitialAnalysisKst:
          dailyRow?.recommendedInitialAnalysisKst ?? null,
        recommendedOddsRefreshKst:
          dailyRow?.recommendedOddsRefreshKst ?? null,
        recommendedFinalDecisionKst:
          dailyRow?.recommendedFinalDecisionKst ?? null,
        officialCloseVerified: dailyRow?.officialCloseVerified ?? false,
        purchaseWarnings: dailyRow?.purchaseWarnings ?? [],
      };
    }),
  };

  await mkdir(path.dirname(WATCHLIST_PATH), { recursive: true });
  if (!unchanged) {
    await writeFile(
      WATCHLIST_PATH,
      `${JSON.stringify(watchWithPurchase, null, 2)}\n`,
      "utf8",
    );
  } else {
    // even if fingerprint same, refresh purchase fields
    await writeFile(
      WATCHLIST_PATH,
      `${JSON.stringify(watchWithPurchase, null, 2)}\n`,
      "utf8",
    );
  }

  const statusCount = (s: string) =>
    baselineGames.filter((g) => g.analysisStatus === s).length;
  const dailyCount = (c: DailyClass) =>
    sorted.filter((g) => g.dailyClass === c).length;

  const observe = sorted.filter((g) => g.dailyClass !== "DAILY_DROP");
  const earlyDeadline = observe.filter((g) =>
    (g.recommendedFinalDecisionKst ?? "").includes("22:50"),
  );
  const morningRecheck = observe.filter(
    (g) => g.purchaseTimingClass === "CONDITIONAL_MORNING_WINDOW",
  );
  const earliestDeadline = [...observe]
    .map((g) => g.recommendedFinalDecisionKst)
    .filter((x): x is string => !!x)
    .sort()[0] ?? null;

  const commonMissing = (() => {
    if (baselineGames.length === 0) return [] as string[];
    const sets = baselineGames.map(
      (g) => new Set(g.missingFactors ?? []),
    );
    const all = new Set(baselineGames.flatMap((g) => g.missingFactors ?? []));
    return [...all].filter((f) => sets.every((s) => s.has(f)));
  })();

  const coverageMeta = asRecord(coverage.meta);
  const coverageUsage = asRecord(coverage.apiUsage) ?? asRecord(coverage.usage);
  const baselineSummary = asRecord(baseline.summary);

  const summaryOutput = {
    meta: {
      version: "mlb-daily-baseline-v1",
      generatedAt: createdAt,
      targetDateKst: TARGET_DATE_KST,
      engineWeightsChanged: false,
      sportsDataIoUsed: false,
      mlbStatsApiInEngine: false,
      predictionSnapshotSaved: false,
      deterministic,
    },
    counts: {
      totalGames: baselineGames.length,
      BASELINE_CANDIDATE: statusCount("BASELINE_CANDIDATE"),
      PASS: statusCount("PASS"),
      INSUFFICIENT_DATA: statusCount("INSUFFICIENT_DATA"),
      DAILY_HIGH: dailyCount("DAILY_HIGH"),
      DAILY_MEDIUM: dailyCount("DAILY_MEDIUM"),
      DAILY_WATCH: dailyCount("DAILY_WATCH"),
      DAILY_DROP: dailyCount("DAILY_DROP"),
    },
    earliestFinalDecisionKst: earliestDeadline,
    previousDay2250Candidates: earlyDeadline.map((g) => ({
      gameId: g.gameId,
      match: g.match,
      pickTeam: g.pickTeam,
      dailyClass: g.dailyClass,
      recommendedFinalDecisionKst: g.recommendedFinalDecisionKst,
    })),
    morningRecheckCandidates: morningRecheck.map((g) => ({
      gameId: g.gameId,
      match: g.match,
      pickTeam: g.pickTeam,
      dailyClass: g.dailyClass,
    })),
    commonMissingFactors: commonMissing,
    notUsableAsBettingLineReason:
      "선발투수·라인업·부상·순위가 Engine에 미반영인 Baseline이다. 확정 추천·베팅 라인이 아니며 재확인이 필요하다.",
    apiUsage: {
      coverage: coverageUsage,
      coverageMeta,
      baselineDeterministic: baselineSummary?.deterministic ?? null,
      filterDeterministic: asRecord(filter.summary)?.deterministic ?? null,
    },
    observeCandidates: observe.map((g) => ({
      gameId: g.gameId,
      match: g.match,
      pickTeam: g.pickTeam,
      dailyClass: g.dailyClass,
      edgeScore: g.edgeScore,
      confidence: g.confidence,
      valueEdge: g.valueEdge,
      bestOdds: g.bestOdds,
      recommendedFinalDecisionKst: g.recommendedFinalDecisionKst,
      purchaseTimingClass: g.purchaseTimingClass,
    })),
  };

  await writeFile(
    DAILY_SUMMARY_PATH,
    `${JSON.stringify(summaryOutput, null, 2)}\n`,
    "utf8",
  );

  console.log("\n=== Daily Baseline Summary ===");
  console.log(`전체 경기: ${baselineGames.length}`);
  console.log(
    `BASELINE_CANDIDATE ${statusCount("BASELINE_CANDIDATE")} / PASS ${statusCount("PASS")} / INSUFFICIENT ${statusCount("INSUFFICIENT_DATA")}`,
  );
  console.log(
    `DAILY_HIGH ${dailyCount("DAILY_HIGH")} / MEDIUM ${dailyCount("DAILY_MEDIUM")} / WATCH ${dailyCount("DAILY_WATCH")} / DROP ${dailyCount("DAILY_DROP")}`,
  );
  console.log("\n후보:");
  for (const g of observe) {
    console.log(
      `  [${g.dailyClass}] ${g.pickTeam} | ${g.match}` +
        ` | EDGE ${g.edgeScore} Conf ${g.confidence} VE ${g.valueEdge} odds ${g.bestOdds}` +
        ` | 마감 ${g.recommendedFinalDecisionKst}`,
    );
  }
  console.log(`\n가장 이른 최종 판단 마감: ${earliestDeadline ?? "n/a"}`);
  console.log(`22:50 이전 결정 후보: ${earlyDeadline.length}`);
  console.log(`당일 오전 재확인 후보: ${morningRecheck.length}`);
  console.log(
    `공통 누락: ${commonMissing.length ? commonMissing.join(", ") : "없음"}`,
  );
  console.log(
    "아직 베팅 라인 불가: 선발·라인업·부상·순위 미반영 Baseline + 재확인 필요",
  );
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(
    `저장: coverage / baseline / filter / watchlist / ${path.relative(ROOT, DAILY_SUMMARY_PATH)}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message.replace(/apiKey=[^&\s]+/gi, "apiKey=***"));
  process.exitCode = 1;
});
