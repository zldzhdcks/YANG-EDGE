/**
 * Build MLB research prediction snapshot from v0 game predictions.
 */
import {
  MLB_PREDICTION_V0_MODEL_VERSION,
  MLB_PREDICTION_V0_NOT_IMPLEMENTED_MARKETS,
  MLB_PREDICTION_V0_STATUS,
  MLB_PREDICTION_V0_SUPPORTED_MARKETS,
} from "./config";
import { configHash, sha256 } from "./math";
import {
  hashPredictions,
  type PredictV0LoadResult,
} from "./load-and-predict";
import type { GamePredictionV0, PredictionSnapshotV0 } from "./types";

function toLegacyRow(
  game: GamePredictionV0,
  predictedAt: string,
  sourceSnapshotVersions: Record<string, string | null>,
): Record<string, unknown> {
  const mp = game.marketPredictions[0]!;
  return {
    predictionId: `${game.gameId}:mlb-baseline-v0`,
    gameId: game.gameId,
    externalId: game.externalId,
    dateKst: game.dateKst,
    startTimeKst: game.startTimeKst,
    league: "MLB",
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    baselinePick: game.baselinePick,
    modelProbability: game.modelProbability,
    edgeScore: game.edgeScore,
    confidence: game.confidence,
    recommendationGrade: null,
    baselineStatus: game.baselineStatus,
    marketProbability: game.marketProbability,
    valueEdge: game.valueEdge,
    openingOdds: game.openingOdds,
    latestOdds: game.latestOdds,
    oddsMovement: game.oddsMovement,
    pitcherDirection: null,
    pitcherReviewAvailable: false,
    dataAvailability:
      mp.inputQuality === "FULL_INPUT"
        ? 0.85
        : mp.inputQuality === "LIMITED_INPUT"
          ? 0.65
          : mp.inputQuality === "STARTER_ONLY"
            ? 0.45
            : 0.3,
    usedFactors: [
      "startingPitcher",
      ...(mp.components.marketPrior !== 0 ? ["marketPrior"] : []),
      "homeAdvantage",
    ],
    missingFactors: mp.missingInputs,
    purchaseEligible: false,
    researchOnly: true,
    purchaseReason: "RESEARCH_DATASET_ONLY",
    predictedAt,
    sourceSnapshotVersions,
    snapshotIntegrity: "VERIFIED",
    integrityWarnings: game.leakage.reasons,
    inputStatus: game.inputStatus,
    inputWarnings: game.inputWarnings,
    officialStatus: game.officialStatus,
    officialPick: game.officialPick,
    passReasons: game.passReasons,
    missingInputs: game.missingInputs,
    researchBaseline: game.researchBaseline,
    marketPredictions: game.marketPredictions,
    modelVersion: MLB_PREDICTION_V0_MODEL_VERSION,
    modelStatus: MLB_PREDICTION_V0_STATUS,
    explanations: mp.explanations,
    components: mp.components,
    resultStatus: "pending",
    homeScore: null,
    awayScore: null,
    actualWinner: null,
    predictionHit: null,
    gradedAt: null,
    feedbackClassification: null,
  };
}

export function buildPredictionSnapshotV0(args: {
  load: Extract<PredictV0LoadResult, { kind: "ready" }>;
  generatedAt: string;
  dryRun: boolean;
  observationOnly: boolean;
  useMarketPrior: boolean;
}): PredictionSnapshotV0 {
  const { load } = args;
  const predictions = load.games.map((g) =>
    toLegacyRow(g, load.predictedAt, load.sourceSnapshotVersions),
  );
  const predictionHashSha256 = hashPredictions(load.games);

  let eligibleCount = 0;
  let passCount = 0;
  let blockedCount = 0;
  let researchBaselineCount = 0;
  let officialPickCount = 0;
  for (const g of load.games) {
    const st = g.officialStatus;
    if (st === "ELIGIBLE") eligibleCount++;
    else if (st === "PASS") passCount++;
    else if (st === "BLOCKED") blockedCount++;
    if (g.researchBaseline.pick) researchBaselineCount++;
    if (g.officialPick) officialPickCount++;
  }

  return {
    meta: {
      schemaVersion: "mlb-research-prediction-snapshot-v1",
      modelVersion: MLB_PREDICTION_V0_MODEL_VERSION,
      modelStatus: MLB_PREDICTION_V0_STATUS,
      configHash: configHash(),
      inputManifestHash: load.inputManifestHash,
      predictionHashSha256,
      generatedAt: args.generatedAt,
      dateKst: load.dateKst,
      marketTypes: [...MLB_PREDICTION_V0_SUPPORTED_MARKETS],
      notImplementedMarkets: [...MLB_PREDICTION_V0_NOT_IMPLEMENTED_MARKETS],
      eligibleCount,
      passCount,
      blockedCount,
      researchBaselineCount,
      officialPickCount,
      observationOnly: args.observationOnly,
      useMarketPrior: args.useMarketPrior,
      dryRun: args.dryRun,
    },
    summary: {
      totalGames: load.games.length,
      predictedGames: load.games.filter((g) => g.officialStatus !== "BLOCKED")
        .length,
      researchOnly: true,
      purchaseEligible: false,
    },
    predictions,
  };
}

export function snapshotWriteHash(doc: PredictionSnapshotV0): string {
  return sha256({
    meta: {
      modelVersion: doc.meta.modelVersion,
      configHash: doc.meta.configHash,
      inputManifestHash: doc.meta.inputManifestHash,
      predictionHashSha256: doc.meta.predictionHashSha256,
      dateKst: doc.meta.dateKst,
      marketTypes: doc.meta.marketTypes,
    },
    predictions: doc.predictions.map((p) => ({
      gameId: p.gameId,
      marketPredictions: p.marketPredictions,
      baselinePick: p.baselinePick,
      modelProbability: p.modelProbability,
      confidence: p.confidence,
      officialStatus: p.officialStatus,
      officialPick: p.officialPick,
    })),
  });
}
