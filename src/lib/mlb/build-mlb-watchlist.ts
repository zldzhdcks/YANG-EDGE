/**
 * MLB 베팅 라인 필터 → 경기 전 관찰 목록.
 *
 * 추천·베팅 지시·예측 스냅샷이 아니다.
 * SportsDataIO Scrambled 값은 Engine에 사용하지 않았음을 warning으로 기록한다.
 */

export type MlbWatchPriority = "HIGH" | "MEDIUM" | "WATCH";

export type MlbWatchRecheckReason =
  | "STARTING_PITCHER_REQUIRED"
  | "LINEUP_REQUIRED"
  | "INJURY_STATUS_REQUIRED"
  | "ODDS_REFRESH_REQUIRED"
  | "STANDINGS_UNAVAILABLE";

export const MLB_WATCHLIST_VERSION = "mlb-watchlist-v1";

export const DEFAULT_RECHECK_REASONS: MlbWatchRecheckReason[] = [
  "STARTING_PITCHER_REQUIRED",
  "LINEUP_REQUIRED",
  "INJURY_STATUS_REQUIRED",
  "ODDS_REFRESH_REQUIRED",
  "STANDINGS_UNAVAILABLE",
];

export const SPORTSDATA_TRIAL_WARNING =
  "SPORTSDATA_TRIAL_SCRAMBLED_NOT_USED" as const;

export type MlbWatchlistLineInput = {
  gameId: string;
  startTimeKst: string;
  homeTeam: string;
  awayTeam: string;
  pickTeam: string | null;
  bestOdds: number | null;
  modelWinProbability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  edgeScore: number | null;
  confidence: number | null;
  dataAvailability: number | null;
  classification: string;
  missingData: string[];
  warnings: string[];
};

export type MlbWatchlistEntry = {
  gameId: string;
  startTimeKst: string;
  homeTeam: string;
  awayTeam: string;
  baselinePick: string | null;
  baselineOdds: number | null;
  modelProbability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  edgeScore: number | null;
  confidence: number | null;
  dataAvailability: number | null;
  currentClassification: string;
  missingData: string[];
  warnings: string[];
  recheckRequired: true;
  recheckReasons: MlbWatchRecheckReason[];
  priority: MlbWatchPriority;
  createdAt: string;
  version: string;
};

export type MlbWatchlistFile = {
  meta: {
    version: string;
    targetDateKst: string;
    kind: "observation-watchlist";
    recommendation: false;
    bettingInstruction: false;
    predictionSnapshotSaved: false;
    generatedAt: string;
    note: string;
  };
  summary: {
    total: number;
    high: number;
    medium: number;
    watch: number;
    excluded: Array<{
      gameId: string;
      pickTeam: string | null;
      classification: string;
      reason: string;
    }>;
    commonRecheckReasons: MlbWatchRecheckReason[];
    notARecommendationReason: string;
  };
  games: MlbWatchlistEntry[];
};

const INCLUDE = new Set(["REVIEW_PRIORITY", "REVIEW_SECONDARY"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function resolveWatchPriority(
  classification: string,
  valueEdge: number | null,
): MlbWatchPriority | null {
  if (classification === "REVIEW_SECONDARY") return "WATCH";
  if (classification === "REVIEW_PRIORITY") {
    if (isFiniteNumber(valueEdge) && valueEdge >= 10) return "HIGH";
    return "MEDIUM";
  }
  return null;
}

const PRIORITY_ORDER: Record<MlbWatchPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  WATCH: 2,
};

export function buildMlbWatchlistEntries(
  lines: MlbWatchlistLineInput[],
  options: {
    createdAt: string;
    existingByGameId?: Map<string, MlbWatchlistEntry>;
  },
): {
  included: MlbWatchlistEntry[];
  excluded: Array<{
    gameId: string;
    pickTeam: string | null;
    classification: string;
    reason: string;
  }>;
} {
  const included: MlbWatchlistEntry[] = [];
  const excluded: Array<{
    gameId: string;
    pickTeam: string | null;
    classification: string;
    reason: string;
  }> = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!INCLUDE.has(line.classification)) {
      excluded.push({
        gameId: line.gameId,
        pickTeam: line.pickTeam,
        classification: line.classification,
        reason:
          line.classification === "MARKET_CONFLICT"
            ? "MARKET_CONFLICT 제외"
            : "INSUFFICIENT 제외",
      });
      continue;
    }

    if (seen.has(line.gameId)) {
      excluded.push({
        gameId: line.gameId,
        pickTeam: line.pickTeam,
        classification: line.classification,
        reason: "동일 gameId 중복 입력 스킵",
      });
      continue;
    }
    seen.add(line.gameId);

    const priority = resolveWatchPriority(
      line.classification,
      line.valueEdge,
    );
    if (!priority) {
      excluded.push({
        gameId: line.gameId,
        pickTeam: line.pickTeam,
        classification: line.classification,
        reason: "관찰 우선순위 미해당",
      });
      continue;
    }

    const existing = options.existingByGameId?.get(line.gameId);
    const warnings = [
      ...line.warnings,
      SPORTSDATA_TRIAL_WARNING,
    ];

    included.push({
      gameId: line.gameId,
      startTimeKst: line.startTimeKst,
      homeTeam: line.homeTeam,
      awayTeam: line.awayTeam,
      baselinePick: line.pickTeam,
      baselineOdds: line.bestOdds,
      modelProbability: line.modelWinProbability,
      marketProbability: line.marketProbability,
      valueEdge: line.valueEdge,
      edgeScore: line.edgeScore,
      confidence: line.confidence,
      dataAvailability: line.dataAvailability,
      currentClassification: line.classification,
      missingData: [...line.missingData],
      warnings: [...new Set(warnings)],
      recheckRequired: true,
      recheckReasons: [...DEFAULT_RECHECK_REASONS],
      priority,
      createdAt: existing?.createdAt ?? options.createdAt,
      version: MLB_WATCHLIST_VERSION,
    });
  }

  included.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    const ve =
      (b.valueEdge ?? Number.NEGATIVE_INFINITY) -
      (a.valueEdge ?? Number.NEGATIVE_INFINITY);
    if (ve !== 0) return ve;
    const time = a.startTimeKst.localeCompare(b.startTimeKst);
    if (time !== 0) return time;
    return a.gameId.localeCompare(b.gameId);
  });

  return { included, excluded };
}

/** createdAt / generatedAt 제외 비교용 지문 */
export function watchlistContentFingerprint(
  games: MlbWatchlistEntry[],
): string {
  return JSON.stringify(
    games.map((game) => ({
      gameId: game.gameId,
      startTimeKst: game.startTimeKst,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      baselinePick: game.baselinePick,
      baselineOdds: game.baselineOdds,
      modelProbability: game.modelProbability,
      marketProbability: game.marketProbability,
      valueEdge: game.valueEdge,
      edgeScore: game.edgeScore,
      confidence: game.confidence,
      dataAvailability: game.dataAvailability,
      currentClassification: game.currentClassification,
      missingData: game.missingData,
      warnings: game.warnings,
      recheckRequired: game.recheckRequired,
      recheckReasons: game.recheckReasons,
      priority: game.priority,
      version: game.version,
    })),
  );
}

export function buildMlbWatchlistFile(input: {
  targetDateKst: string;
  lines: MlbWatchlistLineInput[];
  createdAt: string;
  existing?: MlbWatchlistFile | null;
}): { file: MlbWatchlistFile; unchanged: boolean } {
  const existingByGameId = new Map(
    (input.existing?.games ?? []).map((game) => [game.gameId, game]),
  );
  const { included, excluded } = buildMlbWatchlistEntries(input.lines, {
    createdAt: input.createdAt,
    existingByGameId,
  });

  const file: MlbWatchlistFile = {
    meta: {
      version: MLB_WATCHLIST_VERSION,
      targetDateKst: input.targetDateKst,
      kind: "observation-watchlist",
      recommendation: false,
      bettingInstruction: false,
      predictionSnapshotSaved: false,
      generatedAt: input.existing?.meta.generatedAt ?? input.createdAt,
      note: "경기 전 재확인용 관찰 목록. 실제 추천·베팅 지시가 아니다.",
    },
    summary: {
      total: included.length,
      high: included.filter((g) => g.priority === "HIGH").length,
      medium: included.filter((g) => g.priority === "MEDIUM").length,
      watch: included.filter((g) => g.priority === "WATCH").length,
      excluded,
      commonRecheckReasons: [...DEFAULT_RECHECK_REASONS],
      notARecommendationReason:
        "선발·라인업·부상·순위 미반영 Baseline 관찰 목록이며 SportsDataIO Trial Scrambled 값을 Engine에 사용하지 않았다.",
    },
    games: included,
  };

  const unchanged =
    input.existing != null &&
    watchlistContentFingerprint(input.existing.games) ===
      watchlistContentFingerprint(file.games) &&
    JSON.stringify(input.existing.summary.excluded) ===
      JSON.stringify(file.summary.excluded);

  if (unchanged && input.existing) {
    return { file: input.existing, unchanged: true };
  }

  return { file, unchanged: false };
}
