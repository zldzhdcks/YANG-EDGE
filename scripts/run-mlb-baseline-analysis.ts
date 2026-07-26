/**
 * 2026-07-27 KST MLB 15경기 — API-BASEBALL Baseline AnalysisData + Odds
 * → EDGE Engine 시험 실행.
 *
 * BASELINE 전용. 선발·부상·순위 누락이므로 확정 추천으로 표현하지 않는다.
 * 예측 스냅샷에는 저장하지 않는다.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/run-mlb-baseline-analysis.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runEdgeEngine } from "../src/lib/edge/run-edge-engine";
import { computeFactorScores } from "../src/lib/edge/calculate-edge";
import { getRecommendationGrade } from "../src/lib/edge/recommendation-grade";
import { FACTOR_LABELS } from "../src/lib/edge/build-factors";
import type { EdgeFactorKey, FactorAvailability } from "../src/lib/edge/types";
import { FACTOR_KEYS } from "../src/lib/edge/weights";
import { buildMarketComparison } from "../src/lib/market";
import type {
  AnalysisData,
  HeadToHead,
  MatchResult,
  RecentGame,
  Streak,
  TeamAnalysisSide,
  VenueRecord,
} from "../src/types/engine-analysis";

const TARGET_DATE_KST = (
  process.env.MLB_TARGET_DATE_KST ?? "2026-07-27"
).trim();
const INPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-analysis-coverage.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
);

const EDGE_CANDIDATE_ABS = 10;
const UNAVAILABLE = Number.NaN;

type AnalysisStatus =
  | "INSUFFICIENT_DATA"
  | "PASS"
  | "BASELINE_CANDIDATE";

type FieldBox<T> = {
  value: T | null;
  available: boolean;
  sampleSize?: number | null;
};

type CoverageTeam = {
  teamId?: number;
  teamName: string;
  recentGames: FieldBox<
    Array<{
      dateKst: string;
      opponent: string;
      result: MatchResult;
      scoreFor: number;
      scoreAgainst: number;
      isHome: boolean;
    }>
  >;
  recentForm: FieldBox<string>;
  scoringAverages: FieldBox<{ scoredAvg: number; concededAvg: number }>;
  homeRecord: FieldBox<VenueRecord>;
  awayRecord: FieldBox<VenueRecord>;
  seasonWinRate: FieldBox<number>;
  streak: FieldBox<{ type: "win" | "loss" | "draw"; count: number }>;
  restDays: FieldBox<number>;
  standing: FieldBox<{
    rank: number | null;
    played: number | null;
    wins: number | null;
    draws: number | null;
    losses: number | null;
    winningPercentage: number | null;
    gamesBehind: number | null;
  }>;
  injuries: FieldBox<unknown[]>;
};

type CoverageGame = {
  game: {
    externalId: string;
    commenceTimeUtc: string;
    dateKst: string;
    startTimeKst: string;
    homeTeam: string;
    awayTeam: string;
    league: string | null;
    season: number;
  };
  analysisCandidate: {
    home: CoverageTeam;
    away: CoverageTeam;
    headToHead: FieldBox<{
      played: number;
      homeTeamWins: number;
      awayTeamWins: number;
      draws: number;
      recentMeetings: Array<{
        dateKst: string;
        homeTeam: string;
        awayTeam: string;
        homeScore: number | null;
        awayScore: number | null;
      }>;
    }>;
    startingPitcher: FieldBox<unknown>;
    marketOdds: FieldBox<{
      eventId: string;
      bestHomeOdds: number;
      bestAwayOdds: number;
      normalizedHomeProbability?: number;
      normalizedAwayProbability?: number;
      bookmakerCount?: number;
    }>;
  };
  missingFields?: string[];
};

type CoverageFile = {
  games: CoverageGame[];
};

type GameResultRow = {
  gameId: string;
  startTimeKst: string;
  dateKst: string;
  commenceTimeUtc: string;
  homeTeam: string;
  awayTeam: string;
  pickTeam: string | null;
  pickTeamId: "home" | "away" | null;
  modelWinProbability: number | null;
  edgeScore: number | null;
  confidence: number | null;
  recommendationGrade: string | null;
  dataAvailability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  overround: number | null;
  marketDataQuality: string | null;
  usedFactors: string[];
  missingFactors: string[];
  analysisStatus: AnalysisStatus;
  warnings: string[];
  deterministic: boolean;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function availabilityRatio(a: FactorAvailability): number {
  const on = FACTOR_KEYS.filter((key) => a[key]).length;
  return Math.round((on / FACTOR_KEYS.length) * 1000) / 1000;
}

function emptyVenue(): VenueRecord {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: UNAVAILABLE,
  };
}

function toRecentGames(
  field: CoverageTeam["recentGames"],
): RecentGame[] {
  if (!field.available || !Array.isArray(field.value)) return [];
  return field.value.map((game) => ({
    date: game.dateKst,
    opponent: game.opponent,
    result: game.result,
    scoreFor: game.scoreFor,
    scoreAgainst: game.scoreAgainst,
    isHome: game.isHome,
  }));
}

function toStreak(field: CoverageTeam["streak"]): Streak {
  if (!field.available || field.value == null) {
    return { type: "none", count: 0 };
  }
  return {
    type: field.value.type,
    count: field.value.count,
  };
}

function toTeamSide(team: CoverageTeam): TeamAnalysisSide {
  const recentGames = toRecentGames(team.recentGames);
  const homeRecord =
    team.homeRecord.available && team.homeRecord.value
      ? team.homeRecord.value
      : emptyVenue();
  const awayRecord =
    team.awayRecord.available && team.awayRecord.value
      ? team.awayRecord.value
      : emptyVenue();

  const scoredAvg =
    team.scoringAverages.available && team.scoringAverages.value
      ? team.scoringAverages.value.scoredAvg
      : UNAVAILABLE;
  const concededAvg =
    team.scoringAverages.available && team.scoringAverages.value
      ? team.scoringAverages.value.concededAvg
      : UNAVAILABLE;

  const standing = team.standing;
  const rank =
    standing.available && standing.value?.rank != null
      ? standing.value.rank
      : UNAVAILABLE;
  const winningPercentage =
    standing.available && standing.value?.winningPercentage != null
      ? standing.value.winningPercentage
      : undefined;

  return {
    teamName: team.teamName,
    recentGames,
    homeRecord,
    awayRecord,
    leagueStanding: {
      rank,
      played:
        standing.available && standing.value?.played != null
          ? standing.value.played
          : UNAVAILABLE,
      wins:
        standing.available && standing.value?.wins != null
          ? standing.value.wins
          : UNAVAILABLE,
      draws:
        standing.available && standing.value?.draws != null
          ? standing.value.draws
          : UNAVAILABLE,
      losses:
        standing.available && standing.value?.losses != null
          ? standing.value.losses
          : UNAVAILABLE,
      ...(winningPercentage != null ? { winningPercentage } : {}),
      ...(standing.available && standing.value?.gamesBehind != null
        ? { gamesBehind: standing.value.gamesBehind }
        : {}),
    },
    scoringAverages: { scoredAvg, concededAvg },
    recentForm: {
      sequence:
        team.recentForm.available && team.recentForm.value
          ? team.recentForm.value
          : recentGames.map((game) => game.result).join(""),
      last5: recentGames,
    },
    // 시즌 승률은 실제 games 집계값. 순위(rank) 미확보와 별개.
    winRate:
      team.seasonWinRate.available && team.seasonWinRate.value != null
        ? team.seasonWinRate.value
        : UNAVAILABLE,
    streak: toStreak(team.streak),
    // 실제 부상 목록 없음 — 빈 배열 (임의 생성 금지). Engine은 가용으로 표시할 수 있음.
    injuries: [],
    restDays:
      team.restDays.available && team.restDays.value != null
        ? team.restDays.value
        : UNAVAILABLE,
    startingPitcher: null,
  };
}

function toHeadToHead(
  homeTeam: string,
  field: CoverageGame["analysisCandidate"]["headToHead"],
): HeadToHead {
  if (!field.available || field.value == null) {
    return {
      played: 0,
      homeTeamWins: 0,
      awayTeamWins: 0,
      draws: 0,
      recentMeetings: [],
    };
  }

  const recentMeetings: RecentGame[] = [];
  for (const meeting of field.value.recentMeetings ?? []) {
    if (meeting.homeScore == null || meeting.awayScore == null) continue;
    const isHomePerspective = meeting.homeTeam === homeTeam;
    const scoreFor = isHomePerspective
      ? meeting.homeScore
      : meeting.awayScore;
    const scoreAgainst = isHomePerspective
      ? meeting.awayScore
      : meeting.homeScore;
    let result: MatchResult;
    if (scoreFor > scoreAgainst) result = "W";
    else if (scoreFor < scoreAgainst) result = "L";
    else result = "D";
    recentMeetings.push({
      date: meeting.dateKst,
      opponent: isHomePerspective ? meeting.awayTeam : meeting.homeTeam,
      result,
      scoreFor,
      scoreAgainst,
      isHome: isHomePerspective,
    });
  }

  return {
    played: field.value.played,
    homeTeamWins: field.value.homeTeamWins,
    awayTeamWins: field.value.awayTeamWins,
    draws: field.value.draws,
    recentMeetings: recentMeetings.slice(0, 5),
  };
}

function buildAnalysisData(row: CoverageGame): AnalysisData {
  return {
    gameId: `mlb-${row.game.externalId}`,
    sport: "baseball",
    league: row.game.league ?? "MLB",
    homeTeam: row.game.homeTeam,
    awayTeam: row.game.awayTeam,
    date: row.game.dateKst,
    startTime: row.game.startTimeKst,
    home: toTeamSide(row.analysisCandidate.home),
    away: toTeamSide(row.analysisCandidate.away),
    headToHead: toHeadToHead(
      row.game.homeTeam,
      row.analysisCandidate.headToHead,
    ),
  };
}

function resolveStatus(
  dataAvailability: number,
  edgeScore: number,
): AnalysisStatus {
  if (dataAvailability < 0.7) return "INSUFFICIENT_DATA";
  if (Math.abs(edgeScore) < EDGE_CANDIDATE_ABS) return "PASS";
  return "BASELINE_CANDIDATE";
}

function collectWarnings(row: CoverageGame): string[] {
  const warnings: string[] = [];
  const candidate = row.analysisCandidate;
  if (!candidate.startingPitcher.available) {
    warnings.push("선발투수 미확보");
  }
  if (
    !candidate.home.injuries.available ||
    !candidate.away.injuries.available
  ) {
    warnings.push("부상 미확보");
  }
  if (
    !candidate.home.standing.available ||
    !candidate.away.standing.available
  ) {
    warnings.push("순위 미확보");
  }
  if (!candidate.marketOdds.available || candidate.marketOdds.value == null) {
    warnings.push("시장 확률 없음");
  }
  const homeSample = candidate.home.recentGames.sampleSize ?? 0;
  const awaySample = candidate.away.recentGames.sampleSize ?? 0;
  if (homeSample < 5 || awaySample < 5) {
    warnings.push("최근 경기 표본 팀당 5 미만");
  }
  return warnings;
}

function factorsFromAvailability(availability: FactorAvailability): {
  usedFactors: string[];
  missingFactors: string[];
} {
  const usedFactors: string[] = [];
  const missingFactors: string[] = [];
  for (const key of FACTOR_KEYS) {
    const label = FACTOR_LABELS[key as EdgeFactorKey];
    if (availability[key]) usedFactors.push(label);
    else missingFactors.push(label);
  }
  return { usedFactors, missingFactors };
}

function sanitizeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "number" && !Number.isFinite(item) ? null : item,
    ),
  ) as T;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function analyzeGame(row: CoverageGame): {
  result: GameResultRow;
  analysisInput: AnalysisData;
  engineFingerprint: string;
} {
  const analysis = buildAnalysisData(row);
  const first = runEdgeEngine(analysis);
  const second = runEdgeEngine(analysis);
  const { availability } = computeFactorScores(analysis);
  const dataAvailability = availabilityRatio(availability);
  const { usedFactors, missingFactors } = factorsFromAvailability(availability);
  const grade = getRecommendationGrade(first.edgeScore);
  const warnings = collectWarnings(row);

  const odds = row.analysisCandidate.marketOdds;
  let marketProbability: number | null = null;
  let valueEdge: number | null = null;
  let overround: number | null = null;
  let marketDataQuality: string | null = null;

  if (
    odds.available &&
    odds.value != null &&
    odds.value.bestHomeOdds > 1 &&
    odds.value.bestAwayOdds > 1
  ) {
    const comparison = buildMarketComparison({
      marketType: "two-way",
      odds: {
        homeOdds: odds.value.bestHomeOdds,
        awayOdds: odds.value.bestAwayOdds,
      },
      model: {
        pickTeamId: first.pickTeamId,
        winProbability: first.winProbability,
        marketSupport: "two-way",
      },
    });
    marketDataQuality = comparison.dataQuality;
    overround =
      comparison.overround != null ? round4(comparison.overround) : null;
    if (comparison.comparable && comparison.marketProbability != null) {
      marketProbability = Math.round(comparison.marketProbability * 100);
    }
    if (
      comparison.comparable &&
      comparison.valueEdgePercentagePoints != null
    ) {
      valueEdge = round1(comparison.valueEdgePercentagePoints);
    }
  } else {
    marketDataQuality = "no-odds";
  }

  const edgeScore = round1(first.edgeScore);
  const confidence = Math.round(first.confidence);
  const analysisStatus = resolveStatus(dataAvailability, edgeScore);

  const deterministic =
    first.edgeScore === second.edgeScore &&
    first.confidence === second.confidence &&
    first.winProbability === second.winProbability &&
    first.pickTeamId === second.pickTeamId &&
    first.grade === second.grade;

  const result: GameResultRow = {
    gameId: analysis.gameId,
    startTimeKst: row.game.startTimeKst,
    dateKst: row.game.dateKst,
    commenceTimeUtc: row.game.commenceTimeUtc,
    homeTeam: row.game.homeTeam,
    awayTeam: row.game.awayTeam,
    pickTeam: first.pickTeamName,
    pickTeamId: first.pickTeamId,
    modelWinProbability: Math.round(first.winProbability),
    edgeScore,
    confidence,
    recommendationGrade: grade.grade,
    dataAvailability,
    marketProbability,
    valueEdge,
    overround,
    marketDataQuality,
    usedFactors,
    missingFactors,
    analysisStatus,
    warnings,
    deterministic,
  };

  return {
    result,
    analysisInput: analysis,
    engineFingerprint: stableStringify({
      edgeScore: first.edgeScore,
      confidence: first.confidence,
      winProbability: first.winProbability,
      pickTeamId: first.pickTeamId,
      grade: first.grade,
      factorScores: first.factorScores,
      marketProbability,
      valueEdge,
      analysisStatus,
    }),
  };
}

function sortCandidates(rows: GameResultRow[]): GameResultRow[] {
  return [...rows].sort((a, b) => {
    const absEdgeDiff =
      Math.abs(b.edgeScore ?? 0) - Math.abs(a.edgeScore ?? 0);
    if (absEdgeDiff !== 0) return absEdgeDiff;

    const valueDiff = (b.valueEdge ?? -Infinity) - (a.valueEdge ?? -Infinity);
    if (valueDiff !== 0) return valueDiff;

    const confDiff = (b.confidence ?? -Infinity) - (a.confidence ?? -Infinity);
    if (confDiff !== 0) return confDiff;

    const timeDiff = a.startTimeKst.localeCompare(b.startTimeKst);
    if (timeDiff !== 0) return timeDiff;

    return a.gameId.localeCompare(b.gameId);
  });
}

function commonMissing(rows: GameResultRow[]): string[] {
  if (rows.length === 0) return [];
  const sets = rows.map((row) => new Set(row.missingFactors));
  return FACTOR_KEYS.map((key) => FACTOR_LABELS[key]).filter((label) =>
    sets.every((set) => set.has(label)),
  );
}

function commonWarnings(rows: GameResultRow[]): string[] {
  if (rows.length === 0) return [];
  const sets = rows.map((row) => new Set(row.warnings));
  const all = new Set(rows.flatMap((row) => row.warnings));
  return [...all].filter((warning) =>
    sets.every((set) => set.has(warning)),
  );
}

async function main() {
  console.log(`=== MLB Baseline EDGE Engine (${TARGET_DATE_KST} KST) ===`);
  console.log("입력:", path.relative(process.cwd(), INPUT_PATH));
  console.log("SportsDataIO 값: 미사용");
  console.log("예측 스냅샷 저장: 하지 않음\n");

  const raw = await readFile(INPUT_PATH, "utf8");
  const coverage = JSON.parse(raw) as CoverageFile;
  if (!Array.isArray(coverage.games) || coverage.games.length === 0) {
    throw new Error("coverage games 비어 있음");
  }

  const runOnce = () => {
    const games: Array<{
      result: GameResultRow;
      analysisInput: AnalysisData;
      engineFingerprint: string;
    }> = [];
    for (const row of coverage.games) {
      games.push(analyzeGame(row));
    }
    const results = games.map((item) => item.result);
    const candidates = sortCandidates(
      results.filter((row) => row.analysisStatus === "BASELINE_CANDIDATE"),
    );
    return { games, results, candidates };
  };

  const firstPass = runOnce();
  const secondPass = runOnce();

  const firstFingerprint = stableStringify({
    results: firstPass.results,
    candidateOrder: firstPass.candidates.map((row) => row.gameId),
    engine: firstPass.games.map((item) => item.engineFingerprint),
  });
  const secondFingerprint = stableStringify({
    results: secondPass.results,
    candidateOrder: secondPass.candidates.map((row) => row.gameId),
    engine: secondPass.games.map((item) => item.engineFingerprint),
  });
  const deterministic = firstFingerprint === secondFingerprint;

  const { results, candidates, games } = firstPass;
  const baselineCount = candidates.length;
  const passCount = results.filter(
    (row) => row.analysisStatus === "PASS",
  ).length;
  const insufficientCount = results.filter(
    (row) => row.analysisStatus === "INSUFFICIENT_DATA",
  ).length;
  const top3 = candidates.slice(0, 3);
  const missingCommon = commonMissing(results);
  const warningCommon = commonWarnings(results);

  const usableAsRecommendation = false;
  const notUsableReason = [
    "선발투수·부상·라인업이 반영되지 않은 BASELINE 결과이다.",
    "순위 데이터가 확보되지 않았다.",
    "분석 상태는 BASELINE_CANDIDATE이며 확정 추천(RECOMMENDED)이 아니다.",
    "예측 스냅샷에 저장하지 않았다.",
  ].join(" ");

  const output = sanitizeForJson({
    meta: {
      version: "mlb-baseline-analysis-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      input: path.relative(process.cwd(), INPUT_PATH),
      sportsDataIoUsed: false,
      predictionSnapshotSaved: false,
      analysisKind: "BASELINE",
      note: "선발투수·부상·순위 누락 Baseline. 확정 추천으로 사용하지 않음.",
    },
    summary: {
      totalGames: results.length,
      baselineCandidate: baselineCount,
      pass: passCount,
      insufficientData: insufficientCount,
      deterministic,
      commonMissingFactors: missingCommon,
      commonWarnings: warningCommon,
      usableAsRecommendation,
      notUsableReason,
      strongestCandidates: top3.map((row) => ({
        gameId: row.gameId,
        match: `${row.homeTeam} vs ${row.awayTeam}`,
        startTimeKst: row.startTimeKst,
        pickTeam: row.pickTeam,
        edgeScore: row.edgeScore,
        confidence: row.confidence,
        valueEdge: row.valueEdge,
      })),
    },
    candidates,
    games: games.map((item) => ({
      ...item.result,
      analysisInput: item.analysisInput,
    })),
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );

  console.log(`전체 경기: ${results.length}`);
  console.log(`BASELINE_CANDIDATE: ${baselineCount}`);
  console.log(`PASS: ${passCount}`);
  console.log(`INSUFFICIENT_DATA: ${insufficientCount}`);
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log("\n후보 목록:");
  for (const row of candidates) {
    console.log(
      `  ${row.startTimeKst} ${row.homeTeam} vs ${row.awayTeam}` +
        ` → ${row.pickTeam}` +
        ` | EDGE ${row.edgeScore}` +
        ` | Conf ${row.confidence}` +
        ` | VE ${row.valueEdge ?? "—"}` +
        ` | avail ${row.dataAvailability}`,
    );
  }
  console.log("\n가장 강한 후보 3개:");
  for (const [index, row] of top3.entries()) {
    console.log(
      `  ${index + 1}. ${row.homeTeam} vs ${row.awayTeam}` +
        ` → ${row.pickTeam}` +
        ` (EDGE ${row.edgeScore}, Conf ${row.confidence}, VE ${row.valueEdge ?? "—"})`,
    );
  }
  console.log(
    `\n공통 누락 요인: ${missingCommon.length > 0 ? missingCommon.join(", ") : "없음"}`,
  );
  console.log(
    `공통 warning: ${warningCommon.length > 0 ? warningCommon.join(", ") : "없음"}`,
  );
  console.log(`실제 추천 사용 가능: ${usableAsRecommendation ? "가능" : "불가"}`);
  console.log(`이유: ${notUsableReason}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
