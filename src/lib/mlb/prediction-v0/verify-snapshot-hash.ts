/**
 * Recompute RESEARCH_BASELINE_V0 predictionHashSha256 from a frozen snapshot.
 * Uses the same fingerprint shape as hashPredictions() / predictionContentFingerprint().
 */
import { sha256 } from "../mlb-review-hash";
import { asRecord, asString } from "../mlb-review-utils";

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Fingerprint one market prediction row (matches predictionContentFingerprint). */
function marketFingerprint(raw: unknown): unknown {
  const mp = asRecord(raw) ?? {};
  return {
    marketType: mp.marketType,
    homeProbability: mp.homeProbability,
    awayProbability: mp.awayProbability,
    marketHomeProbability: mp.marketHomeProbability,
    marketAwayProbability: mp.marketAwayProbability,
    modelEdgeHome: mp.modelEdgeHome,
    modelEdgeAway: mp.modelEdgeAway,
    confidence: mp.confidence,
    officialStatus: mp.officialStatus,
    officialPick: mp.officialPick,
    researchBaseline: mp.researchBaseline,
    components: mp.components,
    inputQuality: mp.inputQuality,
    calibration: mp.calibration,
    explanations: mp.explanations,
  };
}

/** Fingerprint one prediction row from snapshot JSON. */
export function snapshotRowContentFingerprint(raw: unknown): unknown {
  const p = asRecord(raw) ?? {};
  return {
    gameId: asString(p.gameId),
    marketPredictions: asArr(p.marketPredictions).map(marketFingerprint),
    baselinePick: p.baselinePick,
    modelProbability: p.modelProbability,
    confidence: p.confidence,
    officialStatus: p.officialStatus,
  };
}

export function recomputeV0PredictionHashFromSnapshot(
  prediction: Record<string, unknown>,
): string {
  const predictions = asArr(prediction.predictions);
  return sha256(predictions.map(snapshotRowContentFingerprint));
}
