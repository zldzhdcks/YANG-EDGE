/**
 * 2026-08-29 C Prediction / PASS reconciliation — OWNER-reviewed seal.
 *
 * Consumer-only. Reads sealed A + B1/B2 candidates + current engine governance.
 * Does not call Result, /predictions, DummyEngine, or mutate weights.
 *
 *   npx tsx scripts/audit-2026-08-29-prediction-pass-reconciliation-v1.ts
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
} from "./lock-2026-08-29-daily-scope-v1";
import { B1_REL, runB1 } from "./audit-2026-08-29-schedule-identity-reconciliation-v1";
import { B2_REL, runB2 } from "./audit-2026-08-29-pregame-input-coverage-v1";

export const C_RECON_REL =
  "data/audits/2026-08-29-prediction-pass-reconciliation-v1.json";
export const C_SNAPSHOT_REL =
  "data/audits/2026-08-29-pregame-prediction-snapshot-v1.json";
export const SEALED_C_RECON_HASH =
  "5d4ffb21788140bceeee24904f5f7992f59be0bb087b9255e5a125410dac0dac";
export const SEALED_C_SNAPSHOT_HASH =
  "f78ce2e18ad834d4e40d55d2df57a241bab7aad26dfa7ddf547e922783d76d84";
export const FROZEN_DECISION_AT = "2026-08-28T13:32:03.190Z";

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
  sport: string;
  scheduledStartAt: string | null;
  decisionAt: string;
  requiredPregameMissing: boolean;
  engineApproved: boolean;
}): { cState: CState; passReasons: string[] } {
  const passReasons: string[] = [];
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
  if (input.scheduledStartAt && Date.parse(input.decisionAt) >= Date.parse(input.scheduledStartAt)) {
    return {
      cState: "PASS_PREGAME_WINDOW_MISSED",
      passReasons: ["PASS_PREGAME_WINDOW_MISSED"],
    };
  }
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
  const b2 = await runB2(cwd);
  const b1 = JSON.parse(readFileSync(path.join(cwd, B1_REL), "utf8")) as {
    games: Array<{
      operatorGameId: string;
      sport: string;
      league: string;
      displayedDateKst: string;
      displayedStartKst: string;
      rawHome: string;
      rawAway: string;
      rawMatchup: string;
      status: string;
      scheduledStartAt: string | null;
      scheduledStartAtUtc: string | null;
      gamePk: number | null;
      canonicalHome: string | null;
      canonicalAway: string | null;
    }>;
    totals: Record<string, number>;
  };
  const b2Doc = JSON.parse(readFileSync(path.join(cwd, B2_REL), "utf8")) as {
    games: Array<{
      operatorGameId: string;
      coverageState: string;
      missingDatasets?: string[];
      marketOddsRole: {
        marketBenchmarkOnly: boolean;
        predictionInput: boolean;
        engineInput: boolean;
      };
    }>;
    marketFirewall: Record<string, unknown>;
  };

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

  const b2ById = new Map(b2Doc.games.map((g) => [g.operatorGameId, g]));
  const games = b1.games.map((g) => {
    const cov = b2ById.get(g.operatorGameId);
    const requiredPregameMissing =
      g.sport === "MLB" &&
      Array.isArray(cov?.missingDatasets) &&
      cov.missingDatasets.length > 0;
    const classified = classifyC({
      b1Status: g.status,
      sport: g.sport,
      scheduledStartAt: g.scheduledStartAt,
      decisionAt,
      requiredPregameMissing,
      engineApproved: g.sport === "MLB" ? engine.approvedForOfficialRecommendation : false,
    });
    const isPrediction = classified.cState === "PREDICTION";
    return {
      operatorGameId: g.operatorGameId,
      sport: g.sport,
      league: g.league,
      displayedDateKst: g.displayedDateKst,
      startTimeKst: g.displayedStartKst,
      rawHome: g.rawHome,
      rawAway: g.rawAway,
      rawMatchup: g.rawMatchup,
      canonicalHome: g.canonicalHome,
      canonicalAway: g.canonicalAway,
      gamePk: g.gamePk,
      scheduledStartAt: g.scheduledStartAt,
      b1Status: g.status,
      b2CoverageState: cov?.coverageState ?? null,
      missingDatasets: cov?.missingDatasets ?? [],
      cState: classified.cState,
      passReasons: classified.passReasons,
      predictedSide: isPrediction ? "WOULD_REQUIRE_APPROVED_ENGINE" : null,
      modelProbability: null,
      confidence: null,
      modelVersion: isPrediction ? engine.modelId : null,
      marketComparison: {
        marketBenchmarkOnly: true,
        predictionInput: false,
        engineInput: false,
        attachedAsModelInput: false,
        note: "Operator odds are comparison-only. Not used to derive side, probability, or confidence.",
      },
      independentPrediction: {
        created: isPrediction,
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

  if (games.length !== b1.totals.officialScopeTotal) {
    throw new Error("C_OFFICIAL_COUNT_MISMATCH");
  }
  const predictionCount = games.filter((g) => g.cState === "PREDICTION").length;
  const passCount = games.filter((g) => g.cState !== "PREDICTION").length;
  const passBreakdown: Record<string, number> = {};
  for (const g of games) {
    if (g.cState === "PREDICTION") continue;
    passBreakdown[g.cState] = (passBreakdown[g.cState] ?? 0) + 1;
  }
  if (predictionCount + passCount !== games.length) {
    throw new Error("C_ACCOUNTING_INCOMPLETE");
  }

  const officialRecommendations = games
    .filter((g) => g.cState === "PREDICTION" && g.independentPrediction.created)
    .map((g) => ({
      game: g.rawMatchup,
      league: g.league,
      startTimeKst: g.startTimeKst,
      predictedSide: g.predictedSide,
      modelProbability: g.modelProbability,
      confidence: g.confidence,
    }));

  const researchCandidates = games
    .filter((g) => g.sport === "MLB" && g.b1Status === "MATCHED")
    .map((g) => ({
      label: "NOT_OFFICIAL_RECOMMENDATION",
      game: g.rawMatchup,
      league: g.league,
      startTimeKst: g.startTimeKst,
      canonicalHome: g.canonicalHome,
      canonicalAway: g.canonicalAway,
      gamePk: g.gamePk,
      reason: engine.rejectionReasons,
      note: "Schedule-matched MLB research candidate only. RESEARCH_BASELINE_V0 is not an official current YANG model.",
    }));

  const snapshot = {
    schemaVersion: "yang-edge-pregame-prediction-snapshot-v1",
    dateKst: DATE_KST,
    stage: "C",
    immutableForResult: true,
    predictedAt: decisionAt,
    decisionAt,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    officialScopeTotal: games.length,
    predictionCount,
    passCount,
    officialRecommendationCount: officialRecommendations.length,
    modelActuallyUsed: engine.approvedForOfficialRecommendation ? engine.modelId : "NONE",
    modelApprovalStatus: engine.approvedForOfficialRecommendation
      ? "APPROVED"
      : "NOT_APPROVED_FOR_OFFICIAL_RECOMMENDATION",
    inspectedModel: engine,
    dummyEngineUsed: false,
    legacyMarketAssistedModelUsed: false,
    marketPriorUsed: false,
    resultCalls: 0,
    predictionProviderCalls: 0,
    engineModified: false,
    weightsModified: false,
    resultDataPresent: false,
    games,
    note: "Immutable pregame C snapshot candidate. No Result data. Do not reopen for Result. Do not commit until OWNER review.",
  };

  const recon = {
    schemaVersion: "yang-edge-prediction-pass-reconciliation-v1",
    dateKst: DATE_KST,
    stage: "C",
    candidateStatus: "OWNER_REVIEW_CANDIDATE",
    decisionAt,
    predictedAt: decisionAt,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    b1Rel: B1_REL,
    b1Sha256: b2.document.b1Sha256,
    b2Rel: B2_REL,
    b2Sha256: b2.sha256,
    sealedLockRel: LOCK_REL,
    sealedLockSha256: sha256File(path.join(cwd, LOCK_REL)),
    snapshotRel: C_SNAPSHOT_REL,
    officialScopeTotal: games.length,
    predictionCount,
    passCount,
    passBreakdown,
    officialRecommendationCount: officialRecommendations.length,
    officialRecommendations,
    researchCandidatesNotOfficialRecommendation: researchCandidates,
    modelActuallyUsed: snapshot.modelActuallyUsed,
    modelApprovalStatus: snapshot.modelApprovalStatus,
    inspectedModel: engine,
    dummyEngineUsed: false,
    legacyMarketAssistedModelUsed: false,
    marketFirewall: b2Doc.marketFirewall,
    resultCalls: 0,
    predictionProviderCalls: 0,
    engineModified: false,
    weightsModified: false,
    leakageStatus: "NO_RESULT_NO_PREDICTIONS_PROVIDER_NO_MARKET_IN_FORMULA",
    games,
    note: "C candidate. PASS is evidence-based from B1 state + engine governance + pregame coverage. Do not commit until OWNER review.",
  };

  await mkdir(path.dirname(path.join(cwd, C_RECON_REL)), { recursive: true });
  const snapBody = `${JSON.stringify(snapshot, null, 2)}\n`;
  const reconBody = `${JSON.stringify(recon, null, 2)}\n`;
  await writeFile(path.join(cwd, C_SNAPSHOT_REL), snapBody, "utf8");
  await writeFile(path.join(cwd, C_RECON_REL), reconBody, "utf8");
  return {
    recon,
    snapshot,
    reconSha256: sha256Text(reconBody),
    snapshotSha256: sha256Text(snapBody),
    b1Sha256: b2.document.b1Sha256,
    b2Sha256: b2.sha256,
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
        dummyEngineUsed: result.recon.dummyEngineUsed,
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
