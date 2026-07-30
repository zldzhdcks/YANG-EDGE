import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { computeFactorScores } from "../src/lib/edge/calculate-edge";
import { buildFactorInsights, FACTOR_LABELS } from "../src/lib/edge/build-factors";
import { runEdgeEngine } from "../src/lib/edge/run-edge-engine";
import { getRecommendationGrade } from "../src/lib/edge/recommendation-grade";
import { FACTOR_KEYS } from "../src/lib/edge/weights";
import { buildMarketComparison } from "../src/lib/market";
import {
  loadMlbPredictionConsumerInput,
  type PredictionInputStatus,
} from "../src/lib/mlb/load-mlb-prediction-consumer-input";
import { getKstToday } from "../src/lib/datetime/kst";

const TARGET_DATE_KST = process.argv[2]?.trim() || getKstToday();
const SNAPSHOT_VERSION = "mlb-research-prediction-snapshot-v1";
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}.json`,
);

const PREDICTION_IMMUTABLE_KEYS = [
  "predictionId",
  "gameId",
  "externalId",
  "dateKst",
  "startTimeKst",
  "league",
  "homeTeam",
  "awayTeam",
  "baselinePick",
  "modelProbability",
  "edgeScore",
  "confidence",
  "recommendationGrade",
  "baselineStatus",
  "marketProbability",
  "valueEdge",
  "openingOdds",
  "latestOdds",
  "oddsMovement",
  "pitcherDirection",
  "pitcherReviewAvailable",
  "dataAvailability",
  "usedFactors",
  "missingFactors",
  "purchaseEligible",
  "researchOnly",
  "purchaseReason",
  "predictedAt",
  "sourceSnapshotVersions",
  "snapshotIntegrity",
  "integrityWarnings",
  "inputStatus",
  "inputWarnings",
] as const;

type BaselineStatus =
  | "BASELINE_CANDIDATE"
  | "PASS"
  | "MARKET_CONFLICT"
  | "INSUFFICIENT";

type SnapshotIntegrity = "VERIFIED" | "UNVERIFIED";

type MlbResearchPrediction = {
  predictionId: string;
  gameId: string;
  externalId: string | null;
  dateKst: string;
  startTimeKst: string | null;
  league: "MLB";
  homeTeam: string;
  awayTeam: string;
  baselinePick: string | null;
  modelProbability: number | null;
  edgeScore: number | null;
  confidence: number | null;
  recommendationGrade: string | null;
  baselineStatus: BaselineStatus;
  marketProbability: number | null;
  valueEdge: number | null;
  openingOdds: number | null;
  latestOdds: number | null;
  oddsMovement: string | null;
  pitcherDirection: string | null;
  pitcherReviewAvailable: boolean;
  dataAvailability: number | null;
  usedFactors: string[];
  missingFactors: string[];
  purchaseEligible: false;
  researchOnly: true;
  purchaseReason: "RESEARCH_DATASET_ONLY";
  predictedAt: string;
  sourceSnapshotVersions: Record<string, string | null>;
  snapshotIntegrity: SnapshotIntegrity;
  integrityWarnings: string[];
  inputStatus: PredictionInputStatus;
  inputWarnings: string[];
  resultStatus: "pending" | "graded" | string;
  homeScore: number | null;
  awayScore: number | null;
  actualWinner: string | null;
  predictionHit: boolean | null;
  gradedAt: string | null;
  feedbackClassification: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function predictionFingerprint(
  item: Pick<MlbResearchPrediction, (typeof PREDICTION_IMMUTABLE_KEYS)[number]>,
): string {
  const payload: Record<string, unknown> = {};
  for (const key of PREDICTION_IMMUTABLE_KEYS) {
    payload[key] = item[key];
  }
  return JSON.stringify(payload);
}

function resolveBaselineStatus(
  inputStatus: PredictionInputStatus,
  dataAvailability: number,
  edgeScore: number,
): BaselineStatus {
  if (inputStatus === "BLOCKED") return "INSUFFICIENT";
  if (dataAvailability < 0.7) return "INSUFFICIENT";
  if (Math.abs(edgeScore) < 10) return "PASS";
  return "BASELINE_CANDIDATE";
}

function toPitcherDirection(edgeScore: number | null): string | null {
  if (edgeScore == null) return null;
  if (edgeScore > 0) return "HOME_EDGE";
  if (edgeScore < 0) return "AWAY_EDGE";
  return "NEUTRAL";
}

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(TARGET_DATE_KST)) {
    console.error("Usage: npm run predict:mlb -- YYYY-MM-DD");
    process.exitCode = 1;
    return;
  }

  const loaded = await loadMlbPredictionConsumerInput(TARGET_DATE_KST);
  if (loaded.kind === "blocked") {
    console.error(loaded.message);
    process.exitCode = 1;
    return;
  }

  console.log(`=== MLB Prediction Consumer (${TARGET_DATE_KST}) ===`);
  console.log("Daily Summary + research artifacts only. No provider calls. No builder execution.\n");

  const built: MlbResearchPrediction[] = [];
  for (const game of loaded.games) {
    const integrityWarnings = [...game.inputWarnings];
    const blocked = game.inputStatus === "BLOCKED";

    let baselinePick: string | null = null;
    let modelProbability: number | null = null;
    let edgeScore: number | null = null;
    let confidence: number | null = null;
    let recommendationGrade: string | null = null;
    let baselineStatus: BaselineStatus = "INSUFFICIENT";
    let marketProbability: number | null = null;
    let valueEdge: number | null = null;
    let pitcherDirection: string | null = null;
    let pitcherReviewAvailable = false;
    let dataAvailability: number | null = null;
    let usedFactors: string[] = [];
    let missingFactors: string[] = [];

    if (!blocked) {
      const factorBreakdown = computeFactorScores(game.analysisData);
      const engine = runEdgeEngine(game.analysisData);
      const availableCount = FACTOR_KEYS.filter(
        (key) => factorBreakdown.availability[key],
      ).length;
      dataAvailability = round3(availableCount / FACTOR_KEYS.length);
      const insights = buildFactorInsights(
        factorBreakdown.scores,
        factorBreakdown.availability,
        engine.pickTeamId,
      );
      usedFactors = insights.filter((item) => item.available).map((item) => item.label);
      missingFactors = FACTOR_KEYS
        .filter((key) => !factorBreakdown.availability[key])
        .map((key) => FACTOR_LABELS[key]);

      baselinePick = engine.pickTeamName;
      modelProbability = Math.round(engine.winProbability);
      edgeScore = round1(engine.edgeScore);
      confidence = Math.round(engine.confidence);
      recommendationGrade = getRecommendationGrade(engine.edgeScore).grade;
      baselineStatus = resolveBaselineStatus(
        game.inputStatus,
        dataAvailability,
        engine.edgeScore,
      );
      pitcherDirection = toPitcherDirection(engine.edgeScore);
      pitcherReviewAvailable =
        game.analysisData.home.startingPitcher != null &&
        game.analysisData.away.startingPitcher != null;

      if (game.homeOdds != null && game.awayOdds != null) {
        const comparison = buildMarketComparison({
          marketType: "two-way",
          odds: {
            homeOdds: game.homeOdds,
            awayOdds: game.awayOdds,
          },
          model: {
            pickTeamId: engine.pickTeamId,
            winProbability: engine.winProbability,
            marketSupport: "two-way",
          },
        });
        if (comparison.comparable && comparison.marketProbability != null) {
          marketProbability = Math.round(comparison.marketProbability * 100);
        }
        if (
          comparison.comparable &&
          comparison.valueEdgePercentagePoints != null
        ) {
          valueEdge = round1(comparison.valueEdgePercentagePoints);
        }
      }
    }

    const snapshotIntegrity: SnapshotIntegrity =
      integrityWarnings.length === 0 ? "VERIFIED" : "UNVERIFIED";

    built.push({
      predictionId: `mlb-research-${TARGET_DATE_KST}-${game.gameId}`,
      gameId: game.gameId,
      externalId: game.externalId,
      dateKst: game.dateKst,
      startTimeKst: game.startTimeKst,
      league: "MLB",
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      baselinePick,
      modelProbability,
      edgeScore,
      confidence,
      recommendationGrade,
      baselineStatus,
      marketProbability,
      valueEdge,
      openingOdds: game.openingOdds,
      latestOdds: game.latestOdds,
      oddsMovement: game.oddsMovement,
      pitcherDirection,
      pitcherReviewAvailable,
      dataAvailability,
      usedFactors,
      missingFactors,
      purchaseEligible: false,
      researchOnly: true,
      purchaseReason: "RESEARCH_DATASET_ONLY",
      predictedAt: loaded.predictedAt,
      sourceSnapshotVersions: { ...loaded.sourceSnapshotVersions },
      snapshotIntegrity,
      integrityWarnings,
      inputStatus: game.inputStatus,
      inputWarnings: game.inputWarnings,
      resultStatus: "pending",
      homeScore: null,
      awayScore: null,
      actualWinner: null,
      predictionHit: null,
      gradedAt: null,
      feedbackClassification: null,
    });
  }

  built.sort((a, b) => a.gameId.localeCompare(b.gameId));

  let existingPredictions: MlbResearchPrediction[] = [];
  let existingMeta: Record<string, unknown> | null = null;
  try {
    const prev = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    const root = asRecord(prev);
    existingMeta = asRecord(root?.meta);
    existingPredictions = Array.isArray(root?.predictions)
      ? (root.predictions as MlbResearchPrediction[])
      : [];
  } catch {}

  const existingById = new Map(existingPredictions.map((p) => [p.gameId, p]));
  let preservedResultCount = 0;
  let preservedExistingPredictions = 0;
  const merged: MlbResearchPrediction[] = [];

  for (const next of built) {
    const prev = existingById.get(next.gameId);
    if (!prev) {
      merged.push(next);
      continue;
    }
    const prevFp = predictionFingerprint(prev);
    const nextFp = predictionFingerprint(next);
    if (prevFp !== nextFp) {
      console.warn(
        `예측 필드 불변 보호: ${next.gameId} — 기존 스냅샷 유지, 신규 입력 무시`,
      );
    }
    if (prev.resultStatus && prev.resultStatus !== "pending") {
      preservedResultCount += 1;
    }
    preservedExistingPredictions += 1;
    merged.push(prevFp === nextFp ? prev : next);
  }

  for (const prev of existingPredictions) {
    if (!merged.some((item) => item.gameId === prev.gameId)) {
      merged.push(prev);
      preservedExistingPredictions += 1;
    }
  }

  merged.sort((a, b) => a.gameId.localeCompare(b.gameId));
  const fingerprintList = merged.map((item) => predictionFingerprint(item));
  const predictionHashSha256 = createHash("sha256")
    .update(JSON.stringify(fingerprintList), "utf8")
    .digest("hex");
  const sameAsExisting =
    existingPredictions.length === merged.length &&
    JSON.stringify(existingPredictions.map((item) => predictionFingerprint(item))) ===
      JSON.stringify(fingerprintList);

  const countStatus = (status: BaselineStatus) =>
    merged.filter((item) => item.baselineStatus === status).length;
  const verified = merged.filter(
    (item) => item.snapshotIntegrity === "VERIFIED",
  ).length;
  const unverified = merged.length - verified;
  const limitedInput = merged.filter(
    (item) => item.inputStatus === "LIMITED_INPUT",
  ).length;
  const blocked = merged.filter((item) => item.inputStatus === "BLOCKED").length;

  const output = {
    meta: {
      version: SNAPSHOT_VERSION,
      dateKst: TARGET_DATE_KST,
      league: "MLB",
      kind: "research-prediction-snapshot",
      generatedAt: sameAsExisting
        ? (asString(existingMeta?.generatedAt) ?? new Date().toISOString())
        : new Date().toISOString(),
      predictedAt: loaded.predictedAt,
      purchaseEligible: false,
      researchOnly: true,
      purchaseReason: "RESEARCH_DATASET_ONLY",
      bettingLine: false,
      engineRerun: false,
      resultsFetched: false,
      immutablePredictionFields: [...PREDICTION_IMMUTABLE_KEYS],
      sourceFiles: {
        dailySummary: loaded.inputManifest.dailySummary.artifact,
        schedule: loaded.inputManifest.inputs.schedule.artifact,
        starter: loaded.inputManifest.inputs.starter.artifact,
        odds: loaded.inputManifest.inputs.odds.artifact,
        lineup: loaded.inputManifest.inputs.lineup.artifact,
      },
      sourceGeneratedAt: {
        dailySummary: loaded.predictedAt,
      },
      sourceSnapshotVersions: loaded.sourceSnapshotVersions,
      predictionHashSha256,
      deterministic: true,
      duplicateSafe: true,
      inputManifest: loaded.inputManifest,
      note:
        "Prediction consumer reads existing MLB research artifacts only. No provider calls, no builder execution, no Research Ready weighting in engine.",
    },
    summary: {
      total: merged.length,
      BASELINE_CANDIDATE: countStatus("BASELINE_CANDIDATE"),
      PASS: countStatus("PASS"),
      MARKET_CONFLICT: 0,
      INSUFFICIENT: countStatus("INSUFFICIENT"),
      purchaseEligible: 0,
      researchOnly: merged.length,
      snapshotIntegrityVerified: verified,
      snapshotIntegrityUnverified: unverified,
      unchangedOnRerun: sameAsExisting,
      preservedExistingPredictions,
      preservedGradedResults: preservedResultCount,
      eligibleGames: merged.filter((item) => item.inputStatus === "ELIGIBLE").length,
      limitedInputGames: limitedInput,
      blockedGames: blocked,
    },
    predictions: merged,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Daily Summary: ${loaded.inputManifest.dailySummary.artifact}`);
  console.log(`Input Hash: ${loaded.inputManifest.inputHash}`);
  console.log(`Predictions: ${merged.length}`);
  console.log(`ELIGIBLE ${merged.filter((item) => item.inputStatus === "ELIGIBLE").length}`);
  console.log(`LIMITED_INPUT ${limitedInput}`);
  console.log(`BLOCKED ${blocked}`);
  console.log(`VERIFIED ${verified} / UNVERIFIED ${unverified}`);
  console.log(`Saved: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
