/**
 * Prediction pregame validity sidecar — Source of Truth for INVALID_FOR_PREGAME.
 * Does not mutate frozen prediction hashes.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { asRecord, asString } from "./mlb-review-utils";

export const MLB_PREDICTION_VALIDITY_SCHEMA =
  "mlb-prediction-validity-v0" as const;

export type ResearchValidity =
  | "VALID_FOR_PREGAME"
  | "INVALID_FOR_PREGAME"
  | "UNKNOWN";

export type MlbPredictionValidityV0 = {
  schemaVersion: typeof MLB_PREDICTION_VALIDITY_SCHEMA;
  dateKst: string;
  generatedAt: string;
  predictionPath: string;
  predictionHashSha256: string | null;
  researchValidity: ResearchValidity;
  reasonCodes: string[];
  cutoff: {
    predictedAt: string | null;
    earliestCommenceTimeUtc: string | null;
    latestCommenceTimeUtc: string | null;
    gamesPredictionAfterStart: number;
    totalGames: number;
  };
  odds: {
    collectedGames: number;
    notCollectedGames: number;
    status: string;
  };
  starter: {
    integrityVerdict: string;
    builderExitCode: number | null;
    probableRows: number;
  };
  lineup: {
    confirmedGames: number;
    postGameConfirmed: boolean;
  };
  resultDependency: number;
  gradingPolicy: {
    researchGraded: "EXCLUDED" | "ALLOWED";
    officialGraded: "EXCLUDED" | "ALLOWED";
    scorecard: "BLOCKED" | "ALLOWED";
    reviewStatus: string;
  };
  quarantineRevisionPath: string | null;
  notes: string[];
};

export function mlbPredictionValidityRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-prediction-validity-v0.json`;
}

export function mlbPregameValidityAuditRel(dateKst: string): string {
  return `data/audits/${dateKst}-mlb-pregame-validity-audit-v1.json`;
}

export async function loadPredictionValidityV0(input: {
  dateKst: string;
  cwd?: string;
}): Promise<MlbPredictionValidityV0 | null> {
  const cwd = input.cwd ?? process.cwd();
  const rel = mlbPredictionValidityRel(input.dateKst);
  try {
    const raw = await readFile(path.join(cwd, rel), "utf8");
    const doc = asRecord(JSON.parse(raw) as unknown);
    if (!doc) return null;
    if (asString(doc.schemaVersion) !== MLB_PREDICTION_VALIDITY_SCHEMA) {
      return null;
    }
    return doc as unknown as MlbPredictionValidityV0;
  } catch {
    return null;
  }
}

export function isInvalidForPregame(
  validity: MlbPredictionValidityV0 | null,
): boolean {
  return validity?.researchValidity === "INVALID_FOR_PREGAME";
}
