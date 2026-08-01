/**
 * Build MLB Prediction Scorecard v0.
 * Additive only — never mutates prediction snapshots. Provider call = 0.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  loadMlbScheduleArtifact,
  writeJsonAtomic,
} from "../build-mlb-schedule-artifact";
import { sha256 } from "../mlb-review-hash";
import { asNumber, asRecord, asString } from "../mlb-review-utils";
import { deriveMoneylineEdgeSemantics } from "../prediction-v0/edge-semantics";
import { SCORECARD_V0_CONFIG } from "./config";
import {
  accuracySummary,
  assignCalibrationBucket,
  brierHome,
  CALIBRATION_BUCKETS,
  CONFIDENCE_BUCKETS,
  logLossHomeAway,
  mean,
  validateProbabilityPair,
} from "./metrics";
import { normalizePredictionGames } from "./normalize-predictions";
import {
  mlbOfficialResultsRel,
  mlbPredictionSnapshotRel,
  mlbScorecardV0Rel,
} from "./paths";
import type {
  CalibrationBucketRow,
  ComponentAlignment,
  ConfidenceBucketRow,
  GradeResult,
  MarketAgreementClass,
  MlbPredictionScorecardV0,
  ScorecardGameGrade,
} from "./types";
import {
  MLB_SCORECARD_V0_GRADE_VERSION,
  MLB_SCORECARD_V0_SCHEMA,
} from "./types";

type OfficialGame = {
  gamePk: number;
  internalGameId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: "HOME" | "AWAY" | "DRAW" | null;
  resultTimestamp: string | null;
};

type ScheduleIndex = {
  byInternalId: Map<
    string,
    {
      gamePk: number;
      homeTeam: string;
      awayTeam: string;
      commenceTimeUtc: string | null;
    }
  >;
  byTeams: Map<string, number[]>;
};

function teamKey(dateKst: string, home: string, away: string): string {
  return `${dateKst}|${home.trim().toLowerCase()}|${away.trim().toLowerCase()}`;
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function classifyResultStatus(status: string | null): {
  bucket: "FINAL" | "VOID" | "PENDING" | "MISSING";
  normalized: string;
} {
  if (!status) return { bucket: "MISSING", normalized: "MISSING" };
  const s = status.toUpperCase();
  if (s === "FINAL") return { bucket: "FINAL", normalized: "FINAL" };
  if (s === "CANCELLED" || s === "POSTPONED" || s === "SUSPENDED") {
    return { bucket: "VOID", normalized: s };
  }
  return { bucket: "PENDING", normalized: s };
}

function gradeSelection(
  selection: "HOME" | "AWAY" | null,
  resultBucket: "FINAL" | "VOID" | "PENDING" | "MISSING",
  winner: "HOME" | "AWAY" | "DRAW" | null,
): GradeResult {
  if (resultBucket === "VOID") return "VOID";
  if (resultBucket === "PENDING" || resultBucket === "MISSING") return "PENDING";
  if (!selection) return "NOT_GRADED";
  if (winner !== "HOME" && winner !== "AWAY") return "VOID";
  return selection === winner ? "CORRECT" : "INCORRECT";
}

function marketAgreementClass(input: {
  homeModelP: number;
  marketHomeP: number | null;
  mostLikely: "HOME" | "AWAY";
}): MarketAgreementClass {
  const { homeModelP, marketHomeP, mostLikely } = input;
  if (marketHomeP == null || !Number.isFinite(marketHomeP)) {
    return "MARKET_MISSING";
  }
  if (Math.abs(homeModelP - 0.5) < SCORECARD_V0_CONFIG.nearEvenAbsFromHalf) {
    return "NEAR_EVEN";
  }
  const mktFav: "HOME" | "AWAY" =
    marketHomeP > 0.5 ? "HOME" : marketHomeP < 0.5 ? "AWAY" : mostLikely;
  return mostLikely === mktFav
    ? "MODEL_AND_MARKET_AGREE"
    : "MODEL_MARKET_DISAGREE";
}

function componentAlignment(
  name: string,
  contribution: number | null,
  winner: "HOME" | "AWAY" | "DRAW" | null,
  resultBucket: "FINAL" | "VOID" | "PENDING" | "MISSING",
): ComponentAlignment {
  if (
    (SCORECARD_V0_CONFIG.disabledComponents as readonly string[]).includes(name)
  ) {
    return "DISABLED";
  }
  if (contribution == null) return "MISSING";
  if (resultBucket !== "FINAL" || (winner !== "HOME" && winner !== "AWAY")) {
    return "NOT_APPLICABLE";
  }
  const eps = SCORECARD_V0_CONFIG.componentNeutralAbs;
  if (Math.abs(contribution) <= eps) return "NEUTRAL";
  const direction: "HOME" | "AWAY" = contribution > 0 ? "HOME" : "AWAY";
  return direction === winner ? "ALIGNED_CORRECT" : "ALIGNED_INCORRECT";
}

/** Deterministic hash: excludes generatedAt, scorecardHash, and CLI run flags. */
export function computeScorecardHash(
  doc: Omit<MlbPredictionScorecardV0, "meta"> & {
    meta: Omit<
      MlbPredictionScorecardV0["meta"],
      "scorecardHash" | "generatedAt" | "dryRun" | "allowPartialResults"
    > & {
      generatedAt?: string;
      scorecardHash?: string;
      dryRun?: boolean;
      allowPartialResults?: boolean;
    };
  },
): string {
  const {
    generatedAt: _g,
    scorecardHash: _h,
    dryRun: _d,
    allowPartialResults: _a,
    ...metaRest
  } = doc.meta;
  void _g;
  void _h;
  void _d;
  void _a;
  return sha256({ ...doc, meta: metaRest });
}

export async function buildMlbPredictionScorecardV0(input: {
  dateKst: string;
  cwd?: string;
  dryRun?: boolean;
  allowPartialResults?: boolean;
  /** Filter by gamePk */
  gamePk?: number | null;
  expectedPredictionHash?: string | null;
  predictionPath?: string;
  resultsPath?: string;
}): Promise<{
  document: MlbPredictionScorecardV0;
  pathRel: string;
  wrote: boolean;
}> {
  const cwd = input.cwd ?? process.cwd();
  const dryRun = input.dryRun === true;
  const allowPartial = input.allowPartialResults === true;
  const dateKst = input.dateKst;
  const predRel = mlbPredictionSnapshotRel(dateKst);
  const resultsRel = mlbOfficialResultsRel(dateKst);
  const outRel = mlbScorecardV0Rel(dateKst);

  const predAbs = input.predictionPath ?? path.join(cwd, predRel);
  const resultsAbs = input.resultsPath ?? path.join(cwd, resultsRel);

  const predRaw = await readFile(predAbs, "utf8");
  const predDoc = asRecord(JSON.parse(predRaw) as unknown);
  if (!predDoc) throw new Error("INVALID_PREDICTION_SNAPSHOT");
  const meta = asRecord(predDoc.meta) ?? {};
  const predictionHash = asString(meta.predictionHashSha256);

  if (
    input.expectedPredictionHash &&
    predictionHash &&
    input.expectedPredictionHash !== predictionHash
  ) {
    throw new Error(
      `PREDICTION_HASH_MISMATCH: expected ${input.expectedPredictionHash} got ${predictionHash}`,
    );
  }

  const allNormalized = normalizePredictionGames(
    asArr(predDoc.predictions),
    meta,
  );

  let resultsHash: string | null = null;
  const resultsByPk = new Map<number, OfficialGame>();
  const resultsById = new Map<string, OfficialGame>();
  let resultsLoaded = false;
  try {
    const resRaw = await readFile(resultsAbs, "utf8");
    const resDoc = asRecord(JSON.parse(resRaw) as unknown);
    resultsHash = asString(resDoc?.resultHash);
    resultsLoaded = true;
    for (const raw of asArr(resDoc?.games)) {
      const g = asRecord(raw);
      if (!g) continue;
      const gamePk = asNumber(g.gamePk);
      if (gamePk == null) continue;
      const winnerRaw = asString(g.winner);
      const winner =
        winnerRaw === "HOME" || winnerRaw === "AWAY" || winnerRaw === "DRAW"
          ? winnerRaw
          : null;
      const row: OfficialGame = {
        gamePk,
        internalGameId:
          asString(g.internalGameId) ?? asString(g.gameId) ?? `mlb-${gamePk}`,
        status: (
          asString(g.status) ??
          asString(g.finalStatus) ??
          "UNKNOWN"
        ).toUpperCase(),
        homeScore: asNumber(g.homeScore),
        awayScore: asNumber(g.awayScore),
        winner,
        resultTimestamp:
          asString(g.resultTimestamp) ?? asString(g.completedAt),
      };
      resultsByPk.set(gamePk, row);
      resultsById.set(row.internalGameId, row);
    }
  } catch {
    resultsLoaded = false;
  }

  let scheduleIndex: ScheduleIndex | null = null;
  try {
    const schedule = await loadMlbScheduleArtifact(dateKst, cwd);
    const byInternalId = new Map<
      string,
      {
        gamePk: number;
        homeTeam: string;
        awayTeam: string;
        commenceTimeUtc: string | null;
      }
    >();
    const byTeams = new Map<string, number[]>();
    for (const g of schedule.games) {
      byInternalId.set(g.internalGameId, {
        gamePk: g.gamePk,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        commenceTimeUtc: g.commenceTimeUtc ?? null,
      });
      const key = teamKey(dateKst, g.homeTeam, g.awayTeam);
      const list = byTeams.get(key) ?? [];
      list.push(g.gamePk);
      byTeams.set(key, list);
    }
    scheduleIndex = { byInternalId, byTeams };
  } catch {
    scheduleIndex = null;
  }

  const warnings: string[] = [];
  if (!resultsLoaded) warnings.push("OFFICIAL_RESULTS_MISSING_OR_UNREADABLE");
  if (allNormalized.some((r) => r.schemaSource === "LEGACY_ADAPTER")) {
    warnings.push("LEGACY_PREDICTION_SCHEMA_ADAPTER");
  }

  const gameGrades: ScorecardGameGrade[] = [];
  let finalGames = 0;
  let pendingGames = 0;
  let voidGames = 0;
  let blockedCount = 0;
  let officialPickCount = 0;

  let researchCorrect = 0;
  let researchIncorrect = 0;
  const researchBriers: number[] = [];
  const researchLogLosses: number[] = [];
  const researchSelectedPs: number[] = [];

  let valuePresent = 0;
  let valueCorrect = 0;
  let valueIncorrect = 0;
  const valueEdges: number[] = [];
  let negativeSelectedSideEdgeCount = 0;

  let posEdgeCorrect = 0;
  let posEdgeIncorrect = 0;
  let negEdgeCorrect = 0;
  let negEdgeIncorrect = 0;

  let homeSelCorrect = 0;
  let homeSelIncorrect = 0;
  let awaySelCorrect = 0;
  let awaySelIncorrect = 0;
  let modelHomeSelections = 0;
  let modelAwaySelections = 0;
  let actualHomeWinners = 0;
  let actualAwayWinners = 0;

  type AgreeAccum = {
    correct: number;
    incorrect: number;
    modelPs: number[];
    marketPs: number[];
    edges: number[];
  };
  const agreeAcc: Record<MarketAgreementClass, AgreeAccum> = {
    MODEL_AND_MARKET_AGREE: {
      correct: 0,
      incorrect: 0,
      modelPs: [],
      marketPs: [],
      edges: [],
    },
    MODEL_MARKET_DISAGREE: {
      correct: 0,
      incorrect: 0,
      modelPs: [],
      marketPs: [],
      edges: [],
    },
    NEAR_EVEN: { correct: 0, incorrect: 0, modelPs: [], marketPs: [], edges: [] },
    MARKET_MISSING: {
      correct: 0,
      incorrect: 0,
      modelPs: [],
      marketPs: [],
      edges: [],
    },
  };

  const calSamples: Record<string, { preds: number[]; actuals: number[] }> = {};
  for (const b of CALIBRATION_BUCKETS) calSamples[b.id] = { preds: [], actuals: [] };

  type ConfAccum = {
    correct: number;
    incorrect: number;
    briers: number[];
    logLosses: number[];
  };
  const confAcc: Record<string, ConfAccum> = {};
  for (const b of CONFIDENCE_BUCKETS) {
    confAcc[b.id] = { correct: 0, incorrect: 0, briers: [], logLosses: [] };
  }

  const componentNames = [
    "starter",
    "marketPrior",
    "homeAdvantage",
    "bullpen",
    "lineup",
  ] as const;
  const componentAcc = Object.fromEntries(
    componentNames.map((n) => [
      n,
      {
        directionalCorrect: 0,
        directionalIncorrect: 0,
        neutral: 0,
        disabled: 0,
        missing: 0,
        magnitudes: [] as number[],
      },
    ]),
  ) as Record<
    (typeof componentNames)[number],
    {
      directionalCorrect: number;
      directionalIncorrect: number;
      neutral: number;
      disabled: number;
      missing: number;
      magnitudes: number[];
    }
  >;

  const blockedPolicyReview: MlbPredictionScorecardV0["blockedPolicyReview"] =
    [];

  for (const row of allNormalized) {
    let gamePk: number | null = row.gamePkHint;
    let commenceTimeUtc: string | null = null;
    if (scheduleIndex) {
      const byId = scheduleIndex.byInternalId.get(row.gameId);
      if (byId) {
        gamePk = byId.gamePk;
        commenceTimeUtc = byId.commenceTimeUtc;
      } else {
        const matches =
          scheduleIndex.byTeams.get(
            teamKey(dateKst, row.homeTeam, row.awayTeam),
          ) ?? [];
        if (matches.length === 1) gamePk = matches[0]!;
      }
    }

    if (input.gamePk != null && gamePk !== input.gamePk) continue;

    const result =
      (gamePk != null ? resultsByPk.get(gamePk) : undefined) ??
      resultsById.get(row.gameId);

    const { bucket: resultBucket, normalized: resultStatus } =
      classifyResultStatus(result?.status ?? null);
    if (resultBucket === "FINAL") finalGames++;
    else if (resultBucket === "VOID") voidGames++;
    else pendingGames++;

    if (result?.winner === "HOME") actualHomeWinners++;
    if (result?.winner === "AWAY") actualAwayWinners++;

    const homeP = row.homeProbability;
    const awayP = row.awayProbability;
    if (homeP != null && awayP != null) {
      const probWarn = validateProbabilityPair(
        homeP,
        awayP,
        SCORECARD_V0_CONFIG.probabilitySumTolerance,
      );
      if (probWarn) warnings.push(`${probWarn}:${row.gameId}`);
    }

    const isBlocked = (row.officialStatus ?? "").toUpperCase() === "BLOCKED";
    if (isBlocked) blockedCount++;
    if (row.officialPick) officialPickCount++;

    let mostLikely = row.researchSelection;
    let mostLikelyP = row.researchProbability;
    let semantics = null;
    if (homeP != null && awayP != null) {
      semantics = deriveMoneylineEdgeSemantics({
        homeProbability: homeP,
        awayProbability: awayP,
        marketHomeProbability: row.marketHomeProbability,
        marketAwayProbability: row.marketAwayProbability,
      });
      if (!mostLikely) {
        mostLikely = semantics.mostLikelySelection;
        mostLikelyP = semantics.mostLikelyProbability;
      } else if (mostLikelyP == null) {
        mostLikelyP =
          mostLikely === "HOME" ? homeP : awayP;
      }
    }

    const valueSelection = semantics?.valueSelection ?? null;
    const valueEdge = semantics?.valueEdge ?? null;
    const selectedSideEdge = semantics?.selectedSideEdge ?? null;

    const researchGrade = gradeSelection(
      mostLikely,
      resultBucket,
      result?.winner ?? null,
    );
    const valueGrade = gradeSelection(
      valueSelection,
      resultBucket,
      result?.winner ?? null,
    );

    let brier: number | null = null;
    let logLoss: number | null = null;
    if (
      resultBucket === "FINAL" &&
      (result?.winner === "HOME" || result?.winner === "AWAY") &&
      homeP != null &&
      awayP != null
    ) {
      const yHome: 0 | 1 = result.winner === "HOME" ? 1 : 0;
      brier = brierHome(homeP, yHome);
      logLoss = logLossHomeAway(homeP, awayP, result.winner);
    }

    const agreement: MarketAgreementClass =
      homeP != null && mostLikely
        ? marketAgreementClass({
            homeModelP: homeP,
            marketHomeP: row.marketHomeProbability,
            mostLikely,
          })
        : "MARKET_MISSING";

    const inResearchSample =
      !isBlocked &&
      mostLikely != null &&
      resultBucket === "FINAL" &&
      (result?.winner === "HOME" || result?.winner === "AWAY") &&
      homeP != null &&
      awayP != null &&
      validateProbabilityPair(
        homeP,
        awayP,
        SCORECARD_V0_CONFIG.probabilitySumTolerance,
      ) == null;

    if (inResearchSample && mostLikely) {
      if (researchGrade === "CORRECT") researchCorrect++;
      else if (researchGrade === "INCORRECT") researchIncorrect++;
      if (mostLikelyP != null) researchSelectedPs.push(mostLikelyP);
      if (brier != null) researchBriers.push(brier);
      if (logLoss != null) researchLogLosses.push(logLoss);

      if (mostLikely === "HOME") {
        modelHomeSelections++;
        if (researchGrade === "CORRECT") homeSelCorrect++;
        else homeSelIncorrect++;
      } else {
        modelAwaySelections++;
        if (researchGrade === "CORRECT") awaySelCorrect++;
        else awaySelIncorrect++;
      }

      if (valueSelection) {
        valuePresent++;
        if (valueGrade === "CORRECT") valueCorrect++;
        else if (valueGrade === "INCORRECT") valueIncorrect++;
        if (valueEdge != null) valueEdges.push(valueEdge);
      }

      if (selectedSideEdge != null && selectedSideEdge < 0) {
        negativeSelectedSideEdgeCount++;
      }

      if (selectedSideEdge != null) {
        if (selectedSideEdge > 0) {
          if (researchGrade === "CORRECT") posEdgeCorrect++;
          else posEdgeIncorrect++;
        } else {
          if (researchGrade === "CORRECT") negEdgeCorrect++;
          else negEdgeIncorrect++;
        }
      }

      const acc = agreeAcc[agreement];
      if (researchGrade === "CORRECT") acc.correct++;
      else acc.incorrect++;
      if (mostLikelyP != null) acc.modelPs.push(mostLikelyP);
      const mktForSel =
        mostLikely === "HOME"
          ? row.marketHomeProbability
          : row.marketAwayProbability;
      if (mktForSel != null) acc.marketPs.push(mktForSel);
      if (selectedSideEdge != null) acc.edges.push(selectedSideEdge);

      // Calibration on SELECTED team probability
      if (mostLikelyP != null) {
        const bucketId = assignCalibrationBucket(mostLikelyP);
        if (bucketId && calSamples[bucketId]) {
          calSamples[bucketId].preds.push(mostLikelyP);
          calSamples[bucketId].actuals.push(
            mostLikely === result!.winner ? 1 : 0,
          );
        }
      }

      if (row.confidence != null) {
        for (const b of CONFIDENCE_BUCKETS) {
          if (row.confidence >= b.lo && row.confidence <= b.hi) {
            const c = confAcc[b.id]!;
            if (researchGrade === "CORRECT") c.correct++;
            else c.incorrect++;
            if (brier != null) c.briers.push(brier);
            if (logLoss != null) c.logLosses.push(logLoss);
            break;
          }
        }
      }
    }

    const components: ScorecardGameGrade["components"] = [];
    for (const name of componentNames) {
      const value = row.components[name] ?? null;
      const alignment = componentAlignment(
        name,
        value,
        result?.winner ?? null,
        resultBucket,
      );
      components.push({ name, value, alignment });
      const ca = componentAcc[name];
      if (alignment === "DISABLED") ca.disabled++;
      else if (alignment === "MISSING") ca.missing++;
      if (inResearchSample) {
        if (value != null) ca.magnitudes.push(Math.abs(value));
        if (alignment === "ALIGNED_CORRECT") ca.directionalCorrect++;
        else if (alignment === "ALIGNED_INCORRECT") ca.directionalIncorrect++;
        else if (alignment === "NEUTRAL") ca.neutral++;
      }
    }

    let counterfactualGrade: GradeResult | null = null;
    if (isBlocked) {
      counterfactualGrade = gradeSelection(
        mostLikely,
        resultBucket,
        result?.winner ?? null,
      );
      if (counterfactualGrade === "CORRECT" || counterfactualGrade === "INCORRECT") {
        // keep
      } else if (resultBucket !== "FINAL") {
        counterfactualGrade =
          resultBucket === "VOID" ? "VOID" : "PENDING";
      }
      blockedPolicyReview.push({
        gamePk,
        gameId: row.gameId,
        blockedReasons:
          row.blockedReasons.length > 0
            ? row.blockedReasons
            : ["BLOCKED"],
        hypotheticalSelection: mostLikely,
        hypotheticalProbability: mostLikelyP,
        actualWinner: result?.winner ?? null,
        counterfactualGrade,
        includedInOfficialDenominator: false,
        includedInResearchDenominator: false,
      });
    }

    gameGrades.push({
      gamePk,
      gameId: row.gameId,
      marketType: "MONEYLINE_2WAY",
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      commenceTimeUtc,
      resultStatus,
      actualWinner: result?.winner ?? null,
      homeScore: result?.homeScore ?? null,
      awayScore: result?.awayScore ?? null,
      officialStatus: row.officialStatus,
      inputQuality: row.inputQuality,
      blockedReasons: isBlocked
        ? row.blockedReasons.length
          ? row.blockedReasons
          : ["BLOCKED"]
        : [],
      confidence: row.confidence,
      modelHomeProbability: homeP,
      modelAwayProbability: awayP,
      selectedProbability: mostLikelyP,
      marketHomeProbability: row.marketHomeProbability,
      marketAwayProbability: row.marketAwayProbability,
      mostLikelySelection: mostLikely,
      selectedSideEdge,
      valueSelection,
      valueEdge,
      researchGrade: isBlocked
        ? resultBucket === "VOID"
          ? "VOID"
          : resultBucket === "PENDING" || resultBucket === "MISSING"
            ? "PENDING"
            : "NOT_GRADED"
        : researchGrade,
      valueGrade: isBlocked ? "NOT_GRADED" : valueGrade,
      brierScore: isBlocked ? null : brier,
      logLoss: isBlocked ? null : logLoss,
      marketAgreement: agreement,
      schemaSource: row.schemaSource,
      components,
      counterfactualBlocked: {
        applicable: isBlocked,
        hypotheticalSelection: mostLikely,
        counterfactualGrade: isBlocked ? counterfactualGrade : null,
      },
    });
  }

  const researchSampleCount = researchCorrect + researchIncorrect;
  const minCal = SCORECARD_V0_CONFIG.minCalibrationSamples;
  const minAgree = SCORECARD_V0_CONFIG.minAgreementSamples;

  const calibrationBuckets: CalibrationBucketRow[] = CALIBRATION_BUCKETS.map(
    (b) => {
      const s = calSamples[b.id]!;
      const n = s.preds.length;
      if (n === 0) {
        return {
          bucket: b.id,
          sampleCount: 0,
          predictedAverage: null,
          actualWinRate: null,
          calibrationGap: null,
          status: "EMPTY",
        };
      }
      const predictedAverage = mean(s.preds);
      const actualWinRate = mean(s.actuals);
      const gap =
        predictedAverage != null && actualWinRate != null
          ? predictedAverage - actualWinRate
          : null;
      return {
        bucket: b.id,
        sampleCount: n,
        predictedAverage,
        actualWinRate,
        calibrationGap: gap,
        status: n < minCal ? "INSUFFICIENT_SAMPLE" : "OBSERVATION_ONLY",
      };
    },
  );

  const confidenceBuckets: ConfidenceBucketRow[] = CONFIDENCE_BUCKETS.map(
    (b) => {
      const c = confAcc[b.id]!;
      const samples = c.correct + c.incorrect;
      return {
        bucket: b.id,
        samples,
        correct: c.correct,
        incorrect: c.incorrect,
        accuracy: samples > 0 ? c.correct / samples : null,
        meanBrier: mean(c.briers),
        meanLogLoss: mean(c.logLosses),
      };
    },
  );

  function agreementBlock(key: MarketAgreementClass) {
    const a = agreeAcc[key];
    const sampleCount = a.correct + a.incorrect;
    const status =
      sampleCount === 0
        ? ("EMPTY" as const)
        : sampleCount < minAgree
          ? ("INSUFFICIENT_SAMPLE" as const)
          : ("OBSERVATION_ONLY" as const);
    return {
      correct: a.correct,
      incorrect: a.incorrect,
      sampleCount,
      accuracy: sampleCount > 0 ? a.correct / sampleCount : null,
      meanModelProbability: mean(a.modelPs),
      meanMarketProbability: mean(a.marketPs),
      meanSelectedSideEdge: mean(a.edges),
      status,
    };
  }

  const metaOfficialPickCount =
    asNumber(meta.officialPickCount) ?? officialPickCount;

  let conclusion: string;
  if (!resultsLoaded) {
    conclusion = "AWAITING_RESULTS";
  } else if (finalGames === 0) {
    conclusion = "AWAITING_FINAL_RESULTS";
  } else if (pendingGames > 0 || voidGames > 0) {
    conclusion = allowPartial
      ? "PARTIAL_SCORECARD"
      : "PARTIAL_SCORECARD";
  } else if (researchSampleCount === 0 && metaOfficialPickCount === 0) {
    conclusion = "NO_GRADABLE_RESEARCH_SAMPLE";
  } else {
    conclusion = "OBSERVATIONAL_SCORECARD_READY";
  }
  // If some pending among finals expected
  if (resultsLoaded && pendingGames > 0 && finalGames > 0) {
    conclusion = "PARTIAL_SCORECARD";
  }
  if (resultsLoaded && pendingGames > 0 && finalGames === 0) {
    conclusion = "AWAITING_FINAL_RESULTS";
  }

  const researchPerf = {
    ...accuracySummary(researchCorrect, researchIncorrect, {
      minForOk: minCal,
    }),
    meanSelectedProbability: mean(researchSelectedPs),
    meanBrierScore: mean(researchBriers),
    meanLogLoss: mean(researchLogLosses),
    sampleCount: researchSampleCount,
  };

  const documentWithoutHash: Omit<MlbPredictionScorecardV0, "meta"> & {
    meta: Omit<MlbPredictionScorecardV0["meta"], "scorecardHash">;
  } = {
    meta: {
      schemaVersion: MLB_SCORECARD_V0_SCHEMA,
      dateKst,
      generatedAt: new Date().toISOString(),
      modelVersion: asString(meta.modelVersion),
      modelStatus: asString(meta.modelStatus),
      gradeVersion: MLB_SCORECARD_V0_GRADE_VERSION,
      predictionHashSha256: predictionHash,
      configHash: asString(meta.configHash),
      inputManifestHash: asString(meta.inputManifestHash),
      officialResultsHash: resultsHash,
      totalGames: gameGrades.length,
      finalGames,
      pendingGames,
      voidGames,
      officialSampleCount: metaOfficialPickCount === 0 ? 0 : 0,
      researchSampleCount,
      blockedCount,
      dryRun,
      allowPartialResults: allowPartial,
      conclusion,
    },
    officialPerformance: {
      officialPickCount: metaOfficialPickCount,
      accuracy: accuracySummary(0, 0, { emptyStatus: "N/A" }),
      note:
        metaOfficialPickCount === 0
          ? "officialAccuracy N/A when officialPickCount is 0"
          : "Official pick grading remains on grade:mlb; scorecard reports N/A until ELIGIBLE path is active",
    },
    researchBaselinePerformance: researchPerf,
    mostLikelyPerformance: { ...researchPerf },
    valueSelectionPerformance: {
      ...accuracySummary(valueCorrect, valueIncorrect, {
        minForOk: minCal,
      }),
      valueSelectionCount: valuePresent,
      averageValueEdge: mean(valueEdges),
      negativeSelectedSideEdgeCount,
      realizedReturn: null,
      note: "realizedReturn placeholder until settled market prices + settlement rules exist",
    },
    selectedSideEdgeSplit: {
      positiveEdge: accuracySummary(posEdgeCorrect, posEdgeIncorrect),
      negativeOrZeroEdge: accuracySummary(negEdgeCorrect, negEdgeIncorrect),
    },
    probabilityMetrics: {
      meanBrierScore: mean(researchBriers),
      meanLogLoss: mean(researchLogLosses),
      sampleCount: researchSampleCount,
    },
    calibrationBuckets,
    confidenceBuckets,
    marketAgreement: {
      MODEL_AND_MARKET_AGREE: agreementBlock("MODEL_AND_MARKET_AGREE"),
      MODEL_MARKET_DISAGREE: agreementBlock("MODEL_MARKET_DISAGREE"),
      NEAR_EVEN: agreementBlock("NEAR_EVEN"),
      MARKET_MISSING: agreementBlock("MARKET_MISSING"),
    },
    componentScorecards: componentNames.map((name) => {
      const c = componentAcc[name];
      const isDisabled = (
        SCORECARD_V0_CONFIG.disabledComponents as readonly string[]
      ).includes(name);
      const sampleCount =
        c.directionalCorrect + c.directionalIncorrect + c.neutral;
      if (isDisabled) {
        return {
          name,
          sampleCount: 0,
          directionalCorrect: 0,
          directionalIncorrect: 0,
          neutral: 0,
          disabled: c.disabled,
          missing: c.missing,
          averageMagnitude: null,
          status: "DISABLED" as const,
        };
      }
      return {
        name,
        sampleCount,
        directionalCorrect: c.directionalCorrect,
        directionalIncorrect: c.directionalIncorrect,
        neutral: c.neutral,
        disabled: c.disabled,
        missing: c.missing,
        averageMagnitude: mean(c.magnitudes),
        status:
          sampleCount < minCal
            ? ("INSUFFICIENT_SAMPLE" as const)
            : ("DIRECTIONAL_ASSOCIATION_ONLY" as const),
      };
    }),
    blockedPolicyReview,
    homeAway: {
      modelHomeSelections,
      modelAwaySelections,
      actualHomeWinners,
      actualAwayWinners,
      modelHomeSelectionAccuracy: accuracySummary(
        homeSelCorrect,
        homeSelIncorrect,
      ),
      modelAwaySelectionAccuracy: accuracySummary(
        awaySelCorrect,
        awaySelIncorrect,
      ),
    },
    gameGrades,
    warnings: [...new Set(warnings)],
    limitations: [...SCORECARD_V0_CONFIG.limitations],
  };

  const scorecardHash = computeScorecardHash(documentWithoutHash);
  const document: MlbPredictionScorecardV0 = {
    ...documentWithoutHash,
    meta: { ...documentWithoutHash.meta, scorecardHash },
  };

  let wrote = false;
  if (!dryRun) {
    await writeJsonAtomic(path.join(cwd, outRel), document);
    wrote = true;
  }

  return { document, pathRel: outRel, wrote };
}
