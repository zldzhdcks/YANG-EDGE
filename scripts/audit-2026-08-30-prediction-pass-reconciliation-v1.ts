/**
 * 2026-08-30 C Prediction / PASS reconciliation + Pregame Snapshot.
 *
 * Consumer-only. Reads sealed A/B1/B2. Does not rewrite B2.
 * Does not call Result, /predictions, DummyEngine, or mutate weights.
 *
 *   npx tsx scripts/audit-2026-08-30-prediction-pass-reconciliation-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  MLB_PREDICTION_V0_OFFICIAL,
  MLB_PREDICTION_V0_STATUS,
  MLB_PREDICTION_V0_WEIGHTS,
  MLB_PREDICTION_V0_MODEL_VERSION,
} from "../src/lib/mlb/prediction-v0/config";
import {
  DATE_KST,
  FROZEN_FORMAL_OBSERVED_AT,
  LOCK_REL,
  sha256File,
} from "./lock-2026-08-30-daily-scope-v1";
import { SEALED_2026_08_29 } from "./intake-2026-08-30-batch-2118-operator-pregame-observations";
import {
  B1_REL,
  REQUIRED_UNRESOLVED,
  SEALED_B1_SHA256,
  SEALED_REGISTRY,
  SEALED_STAGE_A,
} from "./audit-2026-08-30-schedule-identity-reconciliation-v1";
import {
  B2_REL,
  SEALED_B2_SHA256,
} from "./audit-2026-08-30-pregame-input-coverage-v1";

export const C_RECON_REL =
  "data/audits/2026-08-30-prediction-pass-reconciliation-v1.json";
export const C_SNAPSHOT_REL =
  "data/audits/2026-08-30-pregame-prediction-snapshot-v1.json";

export type CState =
  | "PREDICTION"
  | "PASS_ENGINE_NOT_APPROVED"
  | "PASS_IDENTITY_REVIEW_REQUIRED"
  | "PASS_COMPETITION_REVIEW_REQUIRED"
  | "PASS_PROVIDER_NOT_SUPPORTED"
  | "PASS_REQUIRED_PREGAME_DATA_MISSING"
  | "PASS_PREGAME_WINDOW_MISSED";

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function assertUnchanged(
  cwd: string,
  items: ReadonlyArray<{ rel: string; sha256: string }>,
  label: string,
) {
  for (const sealed of items) {
    const sha = sha256File(path.join(cwd, sealed.rel));
    if (sha !== sealed.sha256) throw new Error(`${label}_MUTATED: ${sealed.rel}`);
  }
}

function inspectOfficialMlbEngine() {
  const marketPriorActive =
    MLB_PREDICTION_V0_WEIGHTS.marketPrior.status !== "DISABLED" &&
    MLB_PREDICTION_V0_WEIGHTS.marketPrior.value !== 0;
  const officialPickEnabled = MLB_PREDICTION_V0_OFFICIAL.enableOfficialPick === true;
  const approved =
    officialPickEnabled &&
    MLB_PREDICTION_V0_STATUS !== "RESEARCH_BASELINE_V0" &&
    !marketPriorActive;
  return {
    modelId: MLB_PREDICTION_V0_MODEL_VERSION,
    modelStatus: MLB_PREDICTION_V0_STATUS,
    enableOfficialPick: MLB_PREDICTION_V0_OFFICIAL.enableOfficialPick,
    marketPriorStatus: MLB_PREDICTION_V0_WEIGHTS.marketPrior.status,
    marketPriorValue: MLB_PREDICTION_V0_WEIGHTS.marketPrior.value,
    marketPriorActive,
    dummyEngineUsed: false,
    approvedForOfficialRecommendation: approved,
    rejectionReasons: [
      !officialPickEnabled ? "enableOfficialPick=false" : null,
      MLB_PREDICTION_V0_STATUS === "RESEARCH_BASELINE_V0"
        ? "RESEARCH_BASELINE_V0_NOT_OFFICIAL_CURRENT_MODEL"
        : null,
      marketPriorActive ? "RESEARCH_BASELINE_USES_MARKET_PRIOR" : null,
    ].filter(Boolean),
  };
}

function classifyC(input: {
  b1Status: string;
  scheduledStartAt: string | null;
  decisionAt: string;
  requiredPregameMissing: boolean;
  engineApproved: boolean;
}): { cState: CState; passReasons: string[] } {
  if (input.b1Status === "PROVIDER_NOT_SUPPORTED") {
    return {
      cState: "PASS_PROVIDER_NOT_SUPPORTED",
      passReasons: ["PASS_PROVIDER_NOT_SUPPORTED"],
    };
  }
  if (input.b1Status === "COMPETITION_REVIEW_REQUIRED") {
    return {
      cState: "PASS_COMPETITION_REVIEW_REQUIRED",
      passReasons: ["PASS_COMPETITION_REVIEW_REQUIRED"],
    };
  }
  if (input.b1Status === "IDENTITY_REVIEW_REQUIRED") {
    return {
      cState: "PASS_IDENTITY_REVIEW_REQUIRED",
      passReasons: ["PASS_IDENTITY_REVIEW_REQUIRED"],
    };
  }
  if (
    input.scheduledStartAt &&
    Date.parse(input.decisionAt) >= Date.parse(input.scheduledStartAt)
  ) {
    return {
      cState: "PASS_PREGAME_WINDOW_MISSED",
      passReasons: ["PASS_PREGAME_WINDOW_MISSED"],
    };
  }
  const passReasons: string[] = [];
  if (!input.engineApproved) {
    passReasons.push("PASS_ENGINE_NOT_APPROVED");
    if (input.requiredPregameMissing) {
      passReasons.push("PASS_REQUIRED_PREGAME_DATA_MISSING");
    }
    return { cState: "PASS_ENGINE_NOT_APPROVED", passReasons };
  }
  if (input.requiredPregameMissing) {
    return {
      cState: "PASS_REQUIRED_PREGAME_DATA_MISSING",
      passReasons: ["PASS_REQUIRED_PREGAME_DATA_MISSING"],
    };
  }
  return { cState: "PREDICTION", passReasons: [] };
}

export async function runC(cwd = process.cwd()) {
  assertUnchanged(cwd, SEALED_STAGE_A, "SEALED_2026_08_30_STAGE_A");
  assertUnchanged(cwd, SEALED_2026_08_29, "SEALED_2026_08_29");
  assertUnchanged(cwd, SEALED_REGISTRY, "SEALED_FOOTBALL_REGISTRY");
  const b1Abs = path.join(cwd, B1_REL);
  const b2Abs = path.join(cwd, B2_REL);
  if (sha256File(b1Abs) !== SEALED_B1_SHA256) throw new Error("SEALED_B1_MUTATED");
  if (sha256File(b2Abs) !== SEALED_B2_SHA256) throw new Error("SEALED_B2_MUTATED");

  const b1 = JSON.parse(readFileSync(b1Abs, "utf8")) as {
    rows: Array<{
      rawLeagueLabel: string;
      displayedDateKst: string;
      displayedKickoffKst: string;
      rawHome: string;
      rawAway: string;
      identityStatus: string;
      providerFixtureId: string | null;
    }>;
    mlbPreserved: Array<{
      rawLeagueLabel: string;
      displayedDateKst: string;
      displayedKickoffKst: string;
      rawHome: string;
      rawAway: string;
      identityStatus: string;
      gamePk: number | null;
    }>;
    formalObservedAt: string;
  };
  const b2 = JSON.parse(readFileSync(b2Abs, "utf8")) as {
    candidateStatus: string;
    formalObservedAt: string;
    games: Array<{
      operatorGameId: string;
      sport: string;
      rawMatchup: string;
      b1IdentityStatus: string;
      providerGameId: string | null;
      scheduledStartAt: string;
      coverageState: string;
      missingDatasets?: string[];
    }>;
    marketFirewall: Record<string, unknown>;
    summary: { officialScopeTotal: number };
  };
  if (b2.candidateStatus !== "SEALED") throw new Error("B2_NOT_SEALED");
  if (b1.formalObservedAt !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("FORMAL_OBSERVED_AT_MUTATED");
  }
  if (b2.games.length !== 44) throw new Error("B2_GAME_COUNT");

  const engine = inspectOfficialMlbEngine();
  const snapshotAbs = path.join(cwd, C_SNAPSHOT_REL);
  let decisionAt = new Date().toISOString();
  if (existsSync(snapshotAbs)) {
    const existing = JSON.parse(readFileSync(snapshotAbs, "utf8")) as {
      decisionAt?: string;
      predictedAt?: string;
    };
    if (existing.decisionAt) decisionAt = existing.decisionAt;
    else if (existing.predictedAt) decisionAt = existing.predictedAt;
  }

  const footballByKey = new Map(
    b1.rows.map((r) => [
      `FOOTBALL|${r.displayedDateKst}|${r.displayedKickoffKst}|${r.rawHome}|${r.rawAway}`,
      r,
    ]),
  );
  const mlbByKey = new Map(
    b1.mlbPreserved.map((r) => [
      `MLB|${r.displayedDateKst}|${r.displayedKickoffKst}|${r.rawHome}|${r.rawAway}`,
      r,
    ]),
  );

  const rows = b2.games.map((g) => {
    const parts = g.operatorGameId.split("|");
    const startTimeKst = parts[2] ?? "";
    const displayedDateKst = parts[1] ?? DATE_KST;
    const football = footballByKey.get(g.operatorGameId);
    const mlb = mlbByKey.get(g.operatorGameId);
    const league =
      g.sport === "MLB"
        ? (mlb?.rawLeagueLabel ?? "MLB")
        : (football?.rawLeagueLabel ?? "");
    const identityStatus = g.b1IdentityStatus;
    const requiredPregameMissing =
      identityStatus !== "IDENTITY_REVIEW_REQUIRED" &&
      Array.isArray(g.missingDatasets) &&
      g.missingDatasets.length > 0;
    const classified = classifyC({
      b1Status: identityStatus,
      scheduledStartAt: g.scheduledStartAt,
      decisionAt,
      requiredPregameMissing,
      engineApproved: false,
    });
    return {
      operatorGameId: g.operatorGameId,
      sport: g.sport,
      league,
      displayedDateKst,
      startTimeKst,
      rawMatchup: g.rawMatchup,
      providerGameId: g.providerGameId,
      scheduledStartAt: g.scheduledStartAt,
      b1Status: identityStatus,
      b2CoverageState: g.coverageState,
      missingDatasets: g.missingDatasets ?? [],
      cState: classified.cState,
      passReasons: classified.passReasons,
      predictedSide: null,
      modelProbability: null,
      confidence: null,
      modelVersion: null,
      marketComparison: {
        marketBenchmarkOnly: true,
        predictionInput: false,
        engineInput: false,
        attachedAsModelInput: false,
        note: "Operator odds are comparison-only. Not used to derive side, probability, or confidence.",
      },
      independentPrediction: {
        created: false,
        predictedSide: null,
        independentProbability: null,
        confidence: null,
        engineName: null,
        engineVersion: null,
      },
      dummyEngineUsed: false,
      resultDataPresent: false,
    };
  });

  if (rows.length !== 44) throw new Error("C_OFFICIAL_COUNT_MISMATCH");
  for (const [league, kickoff, home, away] of REQUIRED_UNRESOLVED) {
    const row = rows.find(
      (r) =>
        r.sport === "FOOTBALL" &&
        r.league === league &&
        r.startTimeKst === kickoff &&
        r.rawMatchup === `${home} : ${away}`,
    );
    if (!row) throw new Error(`UNRESOLVED_MISSING:${home}:${away}`);
    if (row.cState !== "PASS_IDENTITY_REVIEW_REQUIRED") {
      throw new Error(`UNRESOLVED_NOT_BLOCKED:${home}:${away}`);
    }
    if (row.providerGameId != null) {
      throw new Error(`UNRESOLVED_HAS_PROVIDER_ID:${home}:${away}`);
    }
  }

  const predictionCount = rows.filter((g) => g.cState === "PREDICTION").length;
  const passCount = rows.filter((g) => g.cState !== "PREDICTION").length;
  const passBreakdown: Record<string, number> = {};
  for (const g of rows) {
    if (g.cState === "PREDICTION") continue;
    passBreakdown[g.cState] = (passBreakdown[g.cState] ?? 0) + 1;
  }
  if (predictionCount + passCount !== 44) throw new Error("C_ACCOUNTING_INCOMPLETE");
  if (predictionCount !== 0) throw new Error("C_UNEXPECTED_PREDICTION");

  const officialRecommendations: unknown[] = [];
  const modelGovernance = {
    inspected: "mlb-baseline-prediction-v0.1.0 + football official model search",
    mlb: engine,
    footballOfficialModel: "NONE",
    dummyEngineUsed: false,
    legacyV1Used: false,
    researchBaselineUsedAsOfficial: false,
    apiFootballPredictionsUsed: false,
    approvedCurrentIndependentMarketFreeModel: false,
  };

  const snapshot = {
    schemaVersion: "yang-edge-pregame-prediction-snapshot-v1",
    dateKst: DATE_KST,
    stage: "C",
    immutableForResult: true,
    predictedAt: decisionAt,
    decisionAt,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    officialScopeTotal: 44,
    predictionCount,
    passCount,
    officialRecommendationCount: 0,
    officialRecommendations,
    modelActuallyUsed: "NONE",
    modelApprovalStatus: "NOT_APPROVED_FOR_OFFICIAL_RECOMMENDATION",
    inspectedModel: engine,
    dummyEngineUsed: false,
    legacyMarketAssistedModelUsed: false,
    marketPriorUsed: false,
    resultCalls: 0,
    predictionProviderCalls: 0,
    engineCalls: 0,
    engineModified: false,
    weightsModified: false,
    resultDataUsed: false,
    fuzzyMatchingUsed: false,
    resultDataPresent: false,
    inputHashes: {
      scopeLock: sha256File(path.join(cwd, LOCK_REL)),
      b1: SEALED_B1_SHA256,
      b2: SEALED_B2_SHA256,
    },
    marketFirewall: b2.marketFirewall,
    rows,
    note: "Immutable pregame C snapshot. No Result / score / winner / grade. Do not reopen for Result.",
  };

  const recon = {
    schemaVersion: "yang-edge-prediction-pass-reconciliation-v1",
    dateKst: DATE_KST,
    stage: "C",
    candidateStatus: "SEALED",
    decisionAt,
    predictedAt: decisionAt,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    scopeLockRel: LOCK_REL,
    scopeLockSha256: sha256File(path.join(cwd, LOCK_REL)),
    sealedLockRel: LOCK_REL,
    sealedLockSha256: sha256File(path.join(cwd, LOCK_REL)),
    b1Rel: B1_REL,
    b1Sha256: SEALED_B1_SHA256,
    b2Rel: B2_REL,
    b2Sha256: SEALED_B2_SHA256,
    snapshotRel: C_SNAPSHOT_REL,
    officialScopeTotal: 44,
    predictionCount,
    passCount,
    passBreakdown,
    officialRecommendationCount: 0,
    officialRecommendations,
    modelGovernance,
    modelActuallyUsed: "NONE",
    modelApprovalStatus: "NOT_APPROVED_FOR_OFFICIAL_RECOMMENDATION",
    inspectedModel: engine,
    dummyEngineUsed: false,
    legacyMarketAssistedModelUsed: false,
    marketFirewall: b2.marketFirewall,
    resultCalls: 0,
    predictionProviderCalls: 0,
    engineCalls: 0,
    engineModified: false,
    weightsModified: false,
    resultDataUsed: false,
    fuzzyMatchingUsed: false,
    leakageStatus: "NO_RESULT_NO_PREDICTIONS_PROVIDER_NO_MARKET_IN_FORMULA",
    rows,
    historicalFirewall: {
      stageAUnchanged: true,
      b1Unchanged: true,
      b2Unchanged: true,
      sealed20260829Unchanged: true,
    },
    note: "No qualifying current approved independent YANG EDGE model exists. Official Recommendation count is 0. PASS is evidence-based.",
  };

  const forbiddenSnapshotKeys = ["score", "winner", "grade", "result"];
  const snapText = JSON.stringify(snapshot);
  for (const key of forbiddenSnapshotKeys) {
    if (new RegExp(`"${key}"\\s*:`, "i").test(snapText)) {
      throw new Error(`SNAPSHOT_FORBIDDEN_FIELD:${key}`);
    }
  }

  await mkdir(path.dirname(path.join(cwd, C_RECON_REL)), { recursive: true });
  const snapBody = `${JSON.stringify(snapshot, null, 2)}\n`;
  const reconBody = `${JSON.stringify(recon, null, 2)}\n`;
  await writeFile(path.join(cwd, C_SNAPSHOT_REL), snapBody, "utf8");
  await writeFile(path.join(cwd, C_RECON_REL), reconBody, "utf8");
  if (sha256File(b2Abs) !== SEALED_B2_SHA256) throw new Error("B2_MUTATED_AFTER_C");
  return {
    recon,
    snapshot,
    reconSha256: sha256Text(reconBody),
    snapshotSha256: sha256Text(snapBody),
  };
}

async function main() {
  const result = await runC();
  console.log(`wrote ${C_RECON_REL}`);
  console.log(`wrote ${C_SNAPSHOT_REL}`);
  console.log(
    JSON.stringify(
      {
        officialRecommendationCount: result.recon.officialRecommendationCount,
        predictionCount: result.recon.predictionCount,
        passCount: result.recon.passCount,
        passBreakdown: result.recon.passBreakdown,
        modelActuallyUsed: result.recon.modelActuallyUsed,
        reconSha256: result.reconSha256,
        snapshotSha256: result.snapshotSha256,
      },
      null,
      2,
    ),
  );
}

const isDirectRun =
  !!process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
