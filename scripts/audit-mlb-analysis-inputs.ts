/**
 * 2026-07-27 MLB AnalysisData 입력 감사 (audit only).
 *
 * - Engine / weights / 추천 / 과거 스냅샷 수정 금지
 * - 결과에 맞춰 입력을 고치지 않는다
 * - 적중·실패 동일 기준
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/audit-mlb-analysis-inputs.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runEdgeEngine } from "../src/lib/edge/run-edge-engine";
import { pickFromEdgeScore } from "../src/lib/edge/calculate-edge";
import { buildMarketComparison } from "../src/lib/market";
import type { AnalysisData, RecentGame } from "../src/types/engine-analysis";

const TARGET_DATE_KST = "2026-07-27";
const EDGE_TOL = 0.05;
const CONF_TOL = 0;
const PROB_TOL = 0;
const VE_TOL = 0.15;

const PATHS = {
  prediction: path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${TARGET_DATE_KST}.json`,
  ),
  review: path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${TARGET_DATE_KST}-review.json`,
  ),
  coverage: path.join(
    process.cwd(),
    "data",
    "daily-tests",
    `${TARGET_DATE_KST}-mlb-analysis-coverage.json`,
  ),
  baseline: path.join(
    process.cwd(),
    "data",
    "daily-tests",
    `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
  ),
  out: path.join(
    process.cwd(),
    "data",
    "audits",
    `${TARGET_DATE_KST}-mlb-analysis-input-audit.json`,
  ),
};

type VerdictClass = "SIGNAL_WORKED" | "SIGNAL_FAILED" | "PENDING" | "OTHER";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function fieldBox(raw: unknown): {
  value: unknown;
  available: boolean;
  sampleSize: number | null;
  cutoffTime: string | null;
} {
  const row = asRecord(raw) ?? {};
  return {
    value: row.value,
    available: row.available === true,
    sampleSize: asNumber(row.sampleSize),
    cutoffTime: asString(row.cutoffTime),
  };
}

function absDiff(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.abs(a - b);
}

function within(a: number | null, b: number | null, tol: number): boolean {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) <= tol;
}

type RecentRaw = {
  externalId: string | null;
  commenceTimeUtc: string | null;
  dateKst: string | null;
  opponent: string | null;
  result: string | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  isHome: boolean | null;
};

function parseRecentList(raw: unknown): RecentRaw[] {
  const box = fieldBox(raw);
  const list = asArray(box.value);
  return list.map((entry) => {
    const row = asRecord(entry) ?? {};
    return {
      externalId:
        asString(row.externalId) ??
        (asNumber(row.externalId) != null
          ? String(asNumber(row.externalId))
          : null),
      commenceTimeUtc: asString(row.commenceTimeUtc),
      dateKst: asString(row.dateKst) ?? asString(row.date),
      opponent: asString(row.opponent),
      result: asString(row.result),
      scoreFor: asNumber(row.scoreFor),
      scoreAgainst: asNumber(row.scoreAgainst),
      isHome: asBoolean(row.isHome),
    };
  });
}

function sideSummary(
  label: "home" | "away",
  teamRaw: Record<string, unknown>,
  analysisSide: AnalysisData["home"] | null,
) {
  const recentBox = fieldBox(teamRaw.recentGames);
  const recent = parseRecentList(teamRaw.recentGames);
  const scoring = fieldBox(teamRaw.scoringAverages);
  const scoringVal = asRecord(scoring.value);
  const season = fieldBox(teamRaw.seasonWinRate);
  const homeRec = fieldBox(teamRaw.homeRecord);
  const awayRec = fieldBox(teamRaw.awayRecord);
  const streak = fieldBox(teamRaw.streak);
  const rest = fieldBox(teamRaw.restDays);
  const homeRecVal = asRecord(homeRec.value);
  const awayRecVal = asRecord(awayRec.value);
  const streakVal = asRecord(streak.value);

  const nullCoerced: string[] = [];
  if (!homeRec.available && analysisSide && analysisSide.homeRecord.played === 0) {
    nullCoerced.push("homeRecord.played→0 when unavailable");
  }
  if (!awayRec.available && analysisSide && analysisSide.awayRecord.played === 0) {
    nullCoerced.push("awayRecord.played→0 when unavailable");
  }
  if (
    !season.available &&
    analysisSide &&
    analysisSide.winRate === 0
  ) {
    nullCoerced.push("seasonWinRate→0 when unavailable");
  }
  if (
    !rest.available &&
    analysisSide &&
    analysisSide.restDays === 0
  ) {
    nullCoerced.push("restDays→0 when unavailable");
  }

  return {
    side: label,
    teamId: asNumber(teamRaw.teamId),
    teamName: asString(teamRaw.teamName) ?? analysisSide?.teamName ?? null,
    gamesPlayedBefore: season.sampleSize,
    recentSampleSize: recentBox.sampleSize ?? recent.length,
    recentGames: recent.map((g) => ({
      externalId: g.externalId,
      dateKst: g.dateKst,
      commenceTimeUtc: g.commenceTimeUtc,
      result: g.result,
      scoreFor: g.scoreFor,
      scoreAgainst: g.scoreAgainst,
      isHome: g.isHome,
      opponent: g.opponent,
    })),
    recentWL: recent.map((g) => g.result).join(""),
    recentScoredAvg:
      asNumber(scoringVal?.scoredAvg) ??
      analysisSide?.scoringAverages.scoredAvg ??
      null,
    recentConcededAvg:
      asNumber(scoringVal?.concededAvg) ??
      analysisSide?.scoringAverages.concededAvg ??
      null,
    seasonWinRate: asNumber(season.value) ?? analysisSide?.winRate ?? null,
    seasonSampleSize: season.sampleSize,
    homeWinRate: asNumber(homeRecVal?.winRate) ?? null,
    homeSampleSize: homeRec.sampleSize ?? asNumber(homeRecVal?.played),
    awayWinRate: asNumber(awayRecVal?.winRate) ?? null,
    awaySampleSize: awayRec.sampleSize ?? asNumber(awayRecVal?.played),
    streak:
      streakVal != null
        ? { type: asString(streakVal.type), count: asNumber(streakVal.count) }
        : analysisSide?.streak ?? null,
    restDays: asNumber(rest.value) ?? analysisSide?.restDays ?? null,
    restAvailable: rest.available,
    restCutoffTime: rest.cutoffTime,
    cutoffTime: recentBox.cutoffTime ?? season.cutoffTime,
    nullCoercedToZero: nullCoerced,
  };
}

function auditLeakage(args: {
  targetExternalId: string | null;
  cutoffTime: string | null;
  targetCommenceUtc: string | null;
  homeRecent: RecentRaw[];
  awayRecent: RecentRaw[];
  h2hMeetings: Array<{ externalId: string | null; dateKst: string | null }>;
}): { leakageDetected: boolean; leakageReasons: string[] } {
  const reasons: string[] = [];
  const cutoffMs = args.cutoffTime ? Date.parse(args.cutoffTime) : NaN;
  const targetMs = args.targetCommenceUtc
    ? Date.parse(args.targetCommenceUtc)
    : cutoffMs;

  const checkList = (
    label: string,
    games: RecentRaw[],
  ) => {
    const ids = games
      .map((g) => g.externalId)
      .filter((id): id is string => id != null);
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        reasons.push(`${label}: duplicate game ${id}`);
      }
      seen.add(id);
      if (args.targetExternalId && id === args.targetExternalId) {
        reasons.push(`${label}: includes target game itself (${id})`);
      }
    }
    for (const g of games) {
      if (!g.commenceTimeUtc) {
        reasons.push(`${label}: missing commenceTimeUtc for ${g.externalId}`);
        continue;
      }
      const ms = Date.parse(g.commenceTimeUtc);
      if (!Number.isFinite(ms)) {
        reasons.push(`${label}: invalid commenceTime ${g.externalId}`);
        continue;
      }
      if (Number.isFinite(targetMs) && ms >= targetMs) {
        reasons.push(
          `${label}: game ${g.externalId} commence >= target commence (future/in-progress/self)`,
        );
      }
      if (Number.isFinite(cutoffMs) && ms >= cutoffMs) {
        reasons.push(
          `${label}: game ${g.externalId} commence >= cutoffTime`,
        );
      }
    }
  };

  checkList("home.recent", args.homeRecent);
  checkList("away.recent", args.awayRecent);

  for (const m of args.h2hMeetings) {
    if (
      args.targetExternalId &&
      m.externalId &&
      m.externalId === args.targetExternalId
    ) {
      reasons.push(`h2h: includes target game ${m.externalId}`);
    }
  }

  return {
    leakageDetected: reasons.length > 0,
    leakageReasons: [...new Set(reasons)],
  };
}

function sampleWarnings(args: {
  home: ReturnType<typeof sideSummary>;
  away: ReturnType<typeof sideSummary>;
  h2hSample: number | null;
}): string[] {
  const warnings: string[] = [];
  for (const side of [args.home, args.away]) {
    if ((side.recentSampleSize ?? 0) < 5) {
      warnings.push(`RECENT_SAMPLE_LT_5:${side.side}`);
    }
    const venueSamples = [
      side.homeSampleSize ?? 0,
      side.awaySampleSize ?? 0,
    ];
    if (venueSamples.some((n) => n > 0 && n < 10)) {
      warnings.push(`HOME_AWAY_SAMPLE_THIN:${side.side}`);
    }
    if ((side.seasonSampleSize ?? 0) > 0 && (side.seasonSampleSize ?? 0) < 20) {
      warnings.push(`SEASON_SAMPLE_THIN:${side.side}`);
    }
    if (!side.restAvailable || side.restDays == null) {
      warnings.push(`REST_DAY_UNVERIFIED:${side.side}`);
    }
    for (const note of side.nullCoercedToZero) {
      warnings.push(`NULL_COERCED_TO_ZERO:${side.side}:${note}`);
    }
  }
  if ((args.h2hSample ?? 0) < 3) {
    warnings.push("H2H_SAMPLE_THIN");
  }
  return warnings;
}

async function main() {
  console.log(`=== Audit MLB Analysis Inputs (${TARGET_DATE_KST}) ===`);

  const prediction = JSON.parse(await readFile(PATHS.prediction, "utf8"));
  const review = JSON.parse(await readFile(PATHS.review, "utf8"));
  const coverage = JSON.parse(await readFile(PATHS.coverage, "utf8"));
  const baseline = JSON.parse(await readFile(PATHS.baseline, "utf8"));

  const predById = new Map(
    asArray(asRecord(prediction)?.predictions).map((entry) => {
      const row = asRecord(entry) ?? {};
      return [asString(row.gameId) ?? "", row] as const;
    }),
  );
  const reviewById = new Map(
    asArray(asRecord(review)?.games).map((entry) => {
      const row = asRecord(entry) ?? {};
      return [asString(row.gameId) ?? "", row] as const;
    }),
  );
  const coverageById = new Map(
    asArray(asRecord(coverage)?.games).map((entry) => {
      const row = asRecord(entry) ?? {};
      const game = asRecord(row.game) ?? {};
      const externalId = asString(game.externalId);
      const gameId = externalId ? `mlb-${externalId}` : null;
      return [gameId ?? "", row] as const;
    }),
  );
  const baselineById = new Map(
    asArray(asRecord(baseline)?.games).map((entry) => {
      const row = asRecord(entry) ?? {};
      return [asString(row.gameId) ?? "", row] as const;
    }),
  );

  const gameIds = [...baselineById.keys()].filter(Boolean).sort();
  const gameAudits = [];

  let leakageErrorCount = 0;
  let mappingErrorCount = 0;
  let reproductionMismatchCount = 0;
  let marketErrorCount = 0;
  let sampleWarningCount = 0;

  const failWarnings: string[] = [];
  const hitWarnings: string[] = [];

  for (const gameId of gameIds) {
    const base = baselineById.get(gameId) ?? {};
    const cov = coverageById.get(gameId) ?? {};
    const pred = predById.get(gameId) ?? {};
    const rev = reviewById.get(gameId) ?? {};
    const gameMeta = asRecord(cov.game) ?? {};
    const candidate = asRecord(cov.analysisCandidate) ?? {};
    const homeTeamRaw = asRecord(candidate.home) ?? {};
    const awayTeamRaw = asRecord(candidate.away) ?? {};
    const h2hBox = fieldBox(candidate.headToHead);
    const h2hVal = asRecord(h2hBox.value);
    const analysisInput = asRecord(base.analysisInput) as AnalysisData | null;
    const leakageGuard = asRecord(cov.leakageGuard) ?? {};

    const cutoffTime =
      asString(leakageGuard.cutoffTime) ??
      asString(gameMeta.commenceTimeUtc);
    const targetExternalId = asString(gameMeta.externalId);
    const homeRecent = parseRecentList(homeTeamRaw.recentGames);
    const awayRecent = parseRecentList(awayTeamRaw.recentGames);
    const h2hMeetings = asArray(h2hVal?.recentMeetings).map((m) => {
      const row = asRecord(m) ?? {};
      return {
        externalId:
          asString(row.externalId) ??
          (asNumber(row.externalId) != null
            ? String(asNumber(row.externalId))
            : null),
        dateKst: asString(row.dateKst),
      };
    });

    const homeSummary = sideSummary(
      "home",
      homeTeamRaw,
      analysisInput?.home ?? null,
    );
    const awaySummary = sideSummary(
      "away",
      awayTeamRaw,
      analysisInput?.away ?? null,
    );

    const leakage = auditLeakage({
      targetExternalId,
      cutoffTime,
      targetCommenceUtc: asString(gameMeta.commenceTimeUtc),
      homeRecent,
      awayRecent,
      h2hMeetings,
    });

    // home/away swap check: analysisInput names vs coverage game
    const mappingErrors: string[] = [];
    const homeName = asString(gameMeta.homeTeam);
    const awayName = asString(gameMeta.awayTeam);
    if (
      analysisInput &&
      homeName &&
      analysisInput.homeTeam !== homeName
    ) {
      mappingErrors.push(
        `analysisInput.homeTeam !== coverage home (${analysisInput.homeTeam} vs ${homeName})`,
      );
    }
    if (
      analysisInput &&
      awayName &&
      analysisInput.awayTeam !== awayName
    ) {
      mappingErrors.push(
        `analysisInput.awayTeam !== coverage away (${analysisInput.awayTeam} vs ${awayName})`,
      );
    }
    if (
      analysisInput &&
      homeName &&
      analysisInput.home.teamName !== homeName
    ) {
      mappingErrors.push("analysisInput.home.teamName mismatch");
    }
    if (
      analysisInput &&
      awayName &&
      analysisInput.away.teamName !== awayName
    ) {
      mappingErrors.push("analysisInput.away.teamName mismatch");
    }
    if (
      homeSummary.teamName &&
      homeName &&
      homeSummary.teamName !== homeName
    ) {
      mappingErrors.push("coverage home teamName mismatch");
    }
    if (
      awaySummary.teamName &&
      awayName &&
      awaySummary.teamName !== awayName
    ) {
      mappingErrors.push("coverage away teamName mismatch");
    }

    const storedEdge = asNumber(base.edgeScore);
    const storedPickId = asString(base.pickTeamId) as "home" | "away" | null;
    const storedPickTeam = asString(base.pickTeam);
    const expectedPick =
      storedEdge != null && homeName && awayName
        ? pickFromEdgeScore(storedEdge, homeName, awayName)
        : null;
    if (
      expectedPick &&
      storedPickId &&
      expectedPick.pickTeamId !== storedPickId
    ) {
      mappingErrors.push(
        `EDGE sign→pick mismatch: edge=${storedEdge} expected ${expectedPick.pickTeamId} got ${storedPickId}`,
      );
    }
    if (
      expectedPick &&
      storedPickTeam &&
      expectedPick.pickTeamName !== storedPickTeam
    ) {
      mappingErrors.push(
        `pickTeam name mismatch: expected ${expectedPick.pickTeamName} got ${storedPickTeam}`,
      );
    }
    // prediction baselinePick alignment
    const predPick = asString(pred.baselinePick);
    if (predPick && storedPickTeam && predPick !== storedPickTeam) {
      mappingErrors.push(
        `prediction.baselinePick !== baseline.pickTeam (${predPick} vs ${storedPickTeam})`,
      );
    }
    if (
      storedEdge != null &&
      storedEdge < 0 &&
      storedPickId !== "away"
    ) {
      mappingErrors.push("negative EDGE not mapped to away pick");
    }
    if (
      storedEdge != null &&
      storedEdge >= 0 &&
      storedPickId !== "home"
    ) {
      mappingErrors.push("non-negative EDGE not mapped to home pick");
    }

    // Engine reproduction
    const reproductionErrors: string[] = [];
    let reproduced: {
      edgeScore: number;
      confidence: number;
      winProbability: number;
      pickTeamId: "home" | "away";
      pickTeamName: string;
    } | null = null;
    if (analysisInput) {
      const first = runEdgeEngine(analysisInput);
      const second = runEdgeEngine(analysisInput);
      reproduced = {
        edgeScore: Math.round(first.edgeScore * 10) / 10,
        confidence: Math.round(first.confidence),
        winProbability: Math.round(first.winProbability),
        pickTeamId: first.pickTeamId,
        pickTeamName: first.pickTeamName,
      };
      if (
        first.edgeScore !== second.edgeScore ||
        first.confidence !== second.confidence ||
        first.winProbability !== second.winProbability ||
        first.pickTeamId !== second.pickTeamId
      ) {
        reproductionErrors.push("ENGINE_NON_DETERMINISTIC");
      }
      if (!within(reproduced.edgeScore, storedEdge, EDGE_TOL)) {
        reproductionErrors.push(
          `REPRODUCTION_MISMATCH:edgeScore stored=${storedEdge} rerun=${reproduced.edgeScore}`,
        );
      }
      if (
        !within(
          reproduced.winProbability,
          asNumber(base.modelWinProbability),
          PROB_TOL,
        )
      ) {
        reproductionErrors.push(
          `REPRODUCTION_MISMATCH:modelProbability stored=${asNumber(base.modelWinProbability)} rerun=${reproduced.winProbability}`,
        );
      }
      if (
        !within(reproduced.confidence, asNumber(base.confidence), CONF_TOL)
      ) {
        reproductionErrors.push(
          `REPRODUCTION_MISMATCH:confidence stored=${asNumber(base.confidence)} rerun=${reproduced.confidence}`,
        );
      }
      if (reproduced.pickTeamId !== storedPickId) {
        reproductionErrors.push(
          `REPRODUCTION_MISMATCH:pick stored=${storedPickId} rerun=${reproduced.pickTeamId}`,
        );
      }
      // also vs prediction snapshot
      if (
        asNumber(pred.edgeScore) != null &&
        !within(reproduced.edgeScore, asNumber(pred.edgeScore), EDGE_TOL)
      ) {
        reproductionErrors.push(
          `REPRODUCTION_MISMATCH:prediction.edgeScore stored=${asNumber(pred.edgeScore)} rerun=${reproduced.edgeScore}`,
        );
      }
      if (
        asNumber(pred.modelProbability) != null &&
        !within(
          reproduced.winProbability,
          asNumber(pred.modelProbability),
          PROB_TOL,
        )
      ) {
        reproductionErrors.push(
          `REPRODUCTION_MISMATCH:prediction.modelProbability stored=${asNumber(pred.modelProbability)} rerun=${reproduced.winProbability}`,
        );
      }
    } else {
      reproductionErrors.push("REPRODUCTION_MISMATCH:missing analysisInput");
    }

    // Market audit — baseline과 동일하게 재실행 winProbability(반올림 전) 사용
    const marketErrors: string[] = [];
    const oddsBox = fieldBox(candidate.marketOdds);
    const oddsVal = asRecord(oddsBox.value);
    const bestHome = asNumber(oddsVal?.bestHomeOdds);
    const bestAway = asNumber(oddsVal?.bestAwayOdds);
    let marketAudit: Record<string, unknown> | null = null;
    if (
      oddsBox.available &&
      bestHome != null &&
      bestAway != null &&
      bestHome > 1 &&
      bestAway > 1 &&
      storedPickId &&
      analysisInput
    ) {
      const engineLive = runEdgeEngine(analysisInput);
      const comparison = buildMarketComparison({
        marketType: "two-way",
        odds: { homeOdds: bestHome, awayOdds: bestAway },
        model: {
          pickTeamId: engineLive.pickTeamId,
          winProbability: engineLive.winProbability,
          marketSupport: "two-way",
        },
      });
      const storedMarket = asNumber(base.marketProbability);
      const storedVe = asNumber(base.valueEdge);
      const recomputedMarketPct =
        comparison.marketProbability != null
          ? Math.round(comparison.marketProbability * 100)
          : null;
      const recomputedVe =
        comparison.valueEdgePercentagePoints != null
          ? Math.round(comparison.valueEdgePercentagePoints * 10) / 10
          : null;

      const flipped = buildMarketComparison({
        marketType: "two-way",
        odds: { homeOdds: bestHome, awayOdds: bestAway },
        model: {
          pickTeamId: engineLive.pickTeamId === "home" ? "away" : "home",
          winProbability: engineLive.winProbability,
          marketSupport: "two-way",
        },
      });
      const flippedPct =
        flipped.marketProbability != null
          ? Math.round(flipped.marketProbability * 100)
          : null;
      if (
        storedMarket != null &&
        recomputedMarketPct != null &&
        flippedPct != null &&
        storedMarket === flippedPct &&
        Math.abs(storedMarket - recomputedMarketPct) > 0
      ) {
        marketErrors.push("MARKET_SIDE_REVERSED");
      }
      if (
        storedMarket != null &&
        recomputedMarketPct != null &&
        storedMarket !== recomputedMarketPct
      ) {
        marketErrors.push(
          `VALUE_EDGE_MISMATCH:marketProbability stored=${storedMarket} recomputed=${recomputedMarketPct}`,
        );
      }
      if (
        storedVe != null &&
        recomputedVe != null &&
        Math.abs(storedVe - recomputedVe) > VE_TOL
      ) {
        marketErrors.push(
          `VALUE_EDGE_MISMATCH:valueEdge stored=${storedVe} recomputed=${recomputedVe}`,
        );
      }
      // 단위확률 기준 항등: VE_pp ≈ (modelUnit - marketUnit)*100
      if (
        comparison.modelProbability != null &&
        comparison.marketProbability != null &&
        storedVe != null
      ) {
        const identity =
          Math.round(
            (comparison.modelProbability - comparison.marketProbability) *
              100 *
              10,
          ) / 10;
        if (Math.abs(storedVe - identity) > VE_TOL) {
          marketErrors.push(
            `VALUE_EDGE_MISMATCH:identity unitDiffPp=${identity} stored=${storedVe}`,
          );
        }
      }
      if (comparison.overround == null) {
        marketErrors.push("OVERROUND_INVALID");
      } else if (comparison.overround < -0.01 || comparison.overround > 0.5) {
        marketErrors.push(
          `OVERROUND_INVALID:overround=${comparison.overround}`,
        );
      }
      if (!(bestHome > 1 && bestAway > 1)) {
        marketErrors.push("ODDS_PAIR_INVALID");
      }

      marketAudit = {
        bestHomeOdds: bestHome,
        bestAwayOdds: bestAway,
        rawImplied: comparison.rawProbabilities,
        overround: comparison.overround,
        normalized: comparison.normalizedProbabilities,
        pickSideMarketProbability: recomputedMarketPct,
        storedMarketProbability: storedMarket,
        storedValueEdge: storedVe,
        recomputedValueEdge: recomputedVe,
        modelProbabilityUsed: engineLive.winProbability,
      };
    } else if (asNumber(base.marketProbability) != null) {
      marketErrors.push("ODDS_PAIR_INVALID:stored market without usable odds");
      marketAudit = {
        bestHomeOdds: bestHome,
        bestAwayOdds: bestAway,
        storedMarketProbability: asNumber(base.marketProbability),
        storedValueEdge: asNumber(base.valueEdge),
      };
    } else {
      marketAudit = {
        bestHomeOdds: bestHome,
        bestAwayOdds: bestAway,
        note: "no usable odds / no stored market",
      };
    }

    const warnings = sampleWarnings({
      home: homeSummary,
      away: awaySummary,
      h2hSample: h2hBox.sampleSize,
    });

    const resultStatus = asString(pred.resultStatus);
    const hit = asBoolean(pred.predictionHit);
    let outcome: VerdictClass = "OTHER";
    if (resultStatus === "pending" || hit == null) outcome = "PENDING";
    else if (hit === true) outcome = "SIGNAL_WORKED";
    else if (hit === false) outcome = "SIGNAL_FAILED";

    if (leakage.leakageDetected) leakageErrorCount += 1;
    if (mappingErrors.length > 0) mappingErrorCount += 1;
    if (reproductionErrors.some((e) => e.startsWith("REPRODUCTION_MISMATCH"))) {
      reproductionMismatchCount += 1;
    }
    if (marketErrors.length > 0) marketErrorCount += 1;
    sampleWarningCount += warnings.length;

    if (outcome === "SIGNAL_FAILED") failWarnings.push(...warnings);
    if (outcome === "SIGNAL_WORKED") hitWarnings.push(...warnings);

    gameAudits.push({
      gameId,
      match: `${awayName ?? "?"} @ ${homeName ?? "?"}`,
      outcome,
      predictionHit: hit,
      resultStatus,
      cutoffTime,
      dataAvailability: {
        coverage: asNumber(cov.dataAvailability),
        baseline: asNumber(base.dataAvailability),
        prediction: asNumber(pred.dataAvailability),
      },
      teamIds: {
        home: homeSummary.teamId,
        away: awaySummary.teamId,
      },
      home: homeSummary,
      away: awaySummary,
      headToHead: {
        sampleSize: h2hBox.sampleSize,
        played: asNumber(h2hVal?.played),
        homeTeamWins: asNumber(h2hVal?.homeTeamWins),
        awayTeamWins: asNumber(h2hVal?.awayTeamWins),
        meetings: h2hMeetings,
      },
      leakage,
      mapping: {
        ok: mappingErrors.length === 0,
        errors: mappingErrors,
        storedEdge,
        storedPickId,
        storedPickTeam,
        expectedPickFromEdge: expectedPick,
        predictionBaselinePick: predPick,
      },
      reproduction: {
        ok: reproductionErrors.length === 0,
        errors: reproductionErrors,
        stored: {
          modelProbability: asNumber(base.modelWinProbability),
          edgeScore: storedEdge,
          confidence: asNumber(base.confidence),
          pick: storedPickTeam,
          pickTeamId: storedPickId,
        },
        rerun: reproduced,
      },
      market: {
        ok: marketErrors.length === 0,
        errors: marketErrors,
        detail: marketAudit,
      },
      sampleWarnings: warnings,
      reviewFeedback: asString(rev.feedbackClassification),
    });
  }

  const countFreq = (list: string[]) => {
    const map = new Map<string, number>();
    for (const w of list) {
      const key = w.split(":")[0] ?? w;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Object.fromEntries([...map.entries()].sort());
  };

  const gradedAudits = gameAudits.filter(
    (g) => g.outcome === "SIGNAL_WORKED" || g.outcome === "SIGNAL_FAILED",
  );
  const failN = gradedAudits.filter((g) => g.outcome === "SIGNAL_FAILED")
    .length;
  const hitN = gradedAudits.filter((g) => g.outcome === "SIGNAL_WORKED")
    .length;

  let conclusion:
    | "INPUT_PIPELINE_CLEAN"
    | "DATA_QUALITY_WARNINGS_ONLY"
    | "CALCULATION_BUG_FOUND"
    | "LEAKAGE_FOUND"
    | "MAPPING_BUG_FOUND" = "INPUT_PIPELINE_CLEAN";

  if (leakageErrorCount > 0) conclusion = "LEAKAGE_FOUND";
  else if (mappingErrorCount > 0) conclusion = "MAPPING_BUG_FOUND";
  else if (reproductionMismatchCount > 0 || marketErrorCount > 0) {
    conclusion = "CALCULATION_BUG_FOUND";
  } else if (sampleWarningCount > 0) {
    conclusion = "DATA_QUALITY_WARNINGS_ONLY";
  }

  const out = {
    meta: {
      version: "mlb-analysis-input-audit-v1",
      dateKst: TARGET_DATE_KST,
      generatedAt: new Date().toISOString(),
      auditOnly: true,
      engineModified: false,
      weightsModified: false,
      snapshotsModified: false,
      sources: {
        prediction: path.relative(process.cwd(), PATHS.prediction).replace(/\\/g, "/"),
        review: path.relative(process.cwd(), PATHS.review).replace(/\\/g, "/"),
        coverage: path.relative(process.cwd(), PATHS.coverage).replace(/\\/g, "/"),
        baseline: path.relative(process.cwd(), PATHS.baseline).replace(/\\/g, "/"),
        apiBaseballRawSeasonCache: "not-persisted (coverage derived fields used)",
        resultsCacheDir: "data/cache/mlb-game-results/",
      },
      note:
        "적중/실패와 무관하게 동일 기준 감사. 인과관계는 단정하지 않는다. null→0 변환·표본 부족은 경고로만 기록.",
    },
    summary: {
      gamesAudited: gameAudits.length,
      gradedForOutcomeCompare: gradedAudits.length,
      pendingExcludedFromOutcomeCompare: gameAudits.filter(
        (g) => g.outcome === "PENDING",
      ).length,
      leakageErrors: leakageErrorCount,
      mappingErrors: mappingErrorCount,
      reproductionMismatches: reproductionMismatchCount,
      marketErrors: marketErrorCount,
      sampleWarningTotal: sampleWarningCount,
      failWarningFrequency: countFreq(failWarnings),
      hitWarningFrequency: countFreq(hitWarnings),
      failGames: failN,
      hitGames: hitN,
      warningRatePerFailGame:
        failN > 0 ? Math.round((failWarnings.length / failN) * 100) / 100 : null,
      warningRatePerHitGame:
        hitN > 0 ? Math.round((hitWarnings.length / hitN) * 100) / 100 : null,
      meaningfulWarningDifference:
        "표본이 작아 실패·적중 그룹 간 경고 빈도 차이를 인과로 해석하지 않는다.",
      conclusion,
    },
    games: gameAudits,
  };

  await mkdir(path.dirname(PATHS.out), { recursive: true });
  await writeFile(PATHS.out, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(`감사 대상 ${gameAudits.length}경기`);
  console.log(`누수 오류 ${leakageErrorCount}`);
  console.log(`매핑 오류 ${mappingErrorCount}`);
  console.log(`재현 불일치 ${reproductionMismatchCount}`);
  console.log(`Market 오류 ${marketErrorCount}`);
  console.log(`표본 경고 ${sampleWarningCount}`);
  console.log(`결론 ${conclusion}`);
  console.log(`저장 ${path.relative(process.cwd(), PATHS.out)}`);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
