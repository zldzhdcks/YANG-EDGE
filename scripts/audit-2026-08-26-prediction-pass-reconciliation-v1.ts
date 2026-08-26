/**
 * 2026-08-26 C Prediction / PASS reconciliation.
 *
 * CONSUMER-ONLY. Reads sealed A/B artifacts. Does not call providers,
 * builders that fetch, Result/Postgame, or Engine/Weight code.
 *
 * Existing KBO/NPB artifacts are PASS snapshots with no approved probability
 * engine (`KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED` /
 * `NPB_ENGINE_NOT_AVAILABLE`). This mission does not invent one.
 *
 *   npx tsx scripts/audit-2026-08-26-prediction-pass-reconciliation-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { instantToKst } from "../src/lib/datetime/kst";
import {
  DATE_KST,
  FROZEN_OBS_HASH,
  LOCK_REL,
  SOURCE_OBS_REL,
  TOTAL_OBSERVED,
  sha256File,
} from "./lock-2026-08-26-daily-scope-v1";
import { RECONCILIATION_REL } from "./audit-2026-08-26-schedule-identity-reconciliation-v1";
import {
  B2_COVERAGE_REL,
  B2_ODDS_OBS_INDEX_REL,
  ORIGINAL_ODDS_INDEX_OBSERVED_AT,
  SEALED_LOCK_HASH,
  SEALED_ODDS_INDEX_HASH,
  SEALED_RECON_HASH,
} from "./audit-2026-08-26-pregame-input-odds-coverage-v1";

export const C_RECON_REL =
  "data/audits/2026-08-26-prediction-pass-reconciliation-v1.json";
export const C_SNAPSHOT_REL =
  "data/audits/2026-08-26-pregame-prediction-snapshot-v1.json";
export const SEALED_B2_COVERAGE_HASH =
  "8bea8a2890dd6f62adb490a362daea0edc3b505649e768de5bf10a64382c7d0e";
export const SEALED_C_MAIN_SHA =
  "3f1ef7ac014d8edb32edbca3d640b54ba4829108";
export const APPROVED_C_RECON_HASH =
  "236e8b99f63eb94236422e7ea5a09f392a3a20b36d9018f7919961bf718e728d";
export const APPROVED_C_SNAPSHOT_HASH =
  "a9cf5201441ce72e2a6428534357701e251c7da616e63ef3458c8da0f078070e";
export const APPROVED_C_PREDICTION_RUN_AT = "2026-08-26T04:17:45.222Z";

export const KBO_ENGINE_POLICY = "NO_OFFICIAL_ENGINE_PICKS_IN_THIS_MISSION";
export const KBO_PIPELINE_STATUS = "KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED";
export const NPB_ENGINE_POLICY = "NO_ENGINE_AVAILABLE";
export const NPB_PIPELINE_STATUS = "NPB_ENGINE_NOT_AVAILABLE";

const FORBIDDEN_PREDICTION_PATHS = [
  "data/predictions/kbo/2026-08-26.json",
  "data/predictions/npb/2026-08-26.json",
];

export type CState =
  | "PREDICTION"
  | "PASS_REQUIRED_INPUT_MISSING"
  | "PASS_IDENTITY_REVIEW_REQUIRED"
  | "PASS_PROVIDER_NOT_SUPPORTED"
  | "PASS_MISSED_PRE_GAME_WINDOW"
  | "PASS_ENGINE_NOT_APPROVED"
  | "PASS_OTHER_EXPLICIT_REASON";

type TemporalGate =
  | "PRE_GAME_ELIGIBLE"
  | "MISSED_PRE_GAME_WINDOW"
  | "IDENTITY_BLOCKED"
  | "PROVIDER_NOT_SUPPORTED";

type B1Game = {
  operatorGameId: string;
  sport: string;
  rawLeagueLabel: string;
  rawHome: string;
  rawAway: string;
  displayedStartKst: string;
  displayedKickoffUtc: string | null;
  status: string;
  missedPreGameWindow: boolean;
  classifiedAsPreGame: boolean;
  canonicalHome?: string | null;
  canonicalAway?: string | null;
  reasons?: string[];
};

type B2Game = {
  operatorGameId: string;
  oddsState?: string;
  oddsProviderEventId?: string | null;
  oddsHomeTeam?: string | null;
  oddsAwayTeam?: string | null;
  oddsBestHome?: number | null;
  oddsBestAway?: number | null;
  impliedHomeProbability?: number | null;
  impliedAwayProbability?: number | null;
};

type IndependentPrediction = {
  created: boolean;
  predictedSide: null;
  independentProbability: null;
  confidence: null;
  engineName: null;
  engineVersion: null;
};

const EMPTY_INDEPENDENT: IndependentPrediction = {
  created: false,
  predictedSide: null,
  independentProbability: null,
  confidence: null,
  engineName: null,
  engineVersion: null,
};

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function assertNoSecrets(value: unknown, trail: string): void {
  const text = JSON.stringify(value);
  if (/apiKey=/i.test(text) || /x-apisports-key/i.test(text)) {
    throw new Error(`SECRET_LEAKAGE:${trail}`);
  }
}

async function writeJson(rel: string, document: unknown, cwd: string) {
  assertNoSecrets(document, rel);
  const abs = path.join(cwd, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  const body = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(abs, body, "utf8");
  return { rel, sha256: sha256Text(body) };
}

function kstStamp(iso: string): string {
  const k = instantToKst(iso);
  return k ? `${k.date} ${k.time} KST` : iso;
}

function classifyTemporalGate(game: B1Game, nowMs: number): TemporalGate {
  if (game.sport === "VOLLEYBALL") return "PROVIDER_NOT_SUPPORTED";
  const kickoff = game.displayedKickoffUtc
    ? Date.parse(game.displayedKickoffUtc)
    : NaN;
  const missed =
    game.missedPreGameWindow === true ||
    (Number.isFinite(kickoff) && nowMs >= kickoff);
  if (missed) return "MISSED_PRE_GAME_WINDOW";
  if (game.status !== "MATCHED") return "IDENTITY_BLOCKED";
  return "PRE_GAME_ELIGIBLE";
}

function footballDetail(game: B1Game): {
  detailCode: string;
  note: string;
} {
  const reasons = game.reasons ?? [];
  if (reasons.some((r) => r.includes("PROVIDER_TEAM") || r.includes("CATALOG_HOME_ID"))) {
    return {
      detailCode: "PASS_PROVIDER_TEAM_ID_CONFLICT",
      note: "Provider team ID/name conflicts with catalog. Football engine not run.",
    };
  }
  if (reasons.includes("UNREGISTERED_COMPETITION")) {
    return {
      detailCode: "PASS_COMPETITION_IDENTITY_BLOCKED",
      note: "Competition not registered for deterministic operator identity. Football engine not run.",
    };
  }
  if (reasons.some((r) => r.startsWith("OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS"))) {
    return {
      detailCode: "PASS_IDENTITY_REVIEW_REQUIRED",
      note: "Operator labels not in approved alias catalog. Football engine not run.",
    };
  }
  if (reasons.some((r) => r.includes("UNKNOWN_PROVIDER_TEAM_ID"))) {
    return {
      detailCode: "PASS_IDENTITY_REVIEW_REQUIRED",
      note: "Provider team IDs are not canonical. Football engine not run.",
    };
  }
  return {
    detailCode: "PASS_IDENTITY_REVIEW_REQUIRED",
    note: "B1 football identity fail-closed. Football engine not run.",
  };
}

function baseballEngine(sport: string) {
  if (sport === "KBO") {
    return {
      implemented: false,
      approved: false,
      policy: KBO_ENGINE_POLICY,
      pipelineStatus: KBO_PIPELINE_STATUS,
      requiredStarterFeature: false,
      requiredBullpenFeature: false,
      requiredLineupFeature: false,
      requiredRecentFormFeature: false,
      requiredTeamFeature: false,
      note: "Existing KBO prediction artifacts are PASS locks. No probability engine is research-approved.",
    };
  }
  return {
    implemented: false,
    approved: false,
    policy: NPB_ENGINE_POLICY,
    pipelineStatus: NPB_PIPELINE_STATUS,
    requiredStarterFeature: false,
    requiredBullpenFeature: false,
    requiredLineupFeature: false,
    requiredRecentFormFeature: false,
    requiredTeamFeature: false,
    note: "Existing NPB snapshots are PREGAME_EVIDENCE with NO_ENGINE_AVAILABLE. No probability engine is research-approved.",
  };
}

export function computeIndependentDecision(input: {
  game: B1Game;
  nowMs: number;
}): {
  temporalGate: TemporalGate;
  eligibility: "PREDICTION_ELIGIBLE" | "NOT_ELIGIBLE";
  cState: CState;
  independentPrediction: IndependentPrediction;
  eligibilityChecklist: Record<string, unknown>;
  passReasons: string[];
  footballEngineRun: false;
  volleyballEngineInvented: false;
} {
  const game = input.game;
  const temporalGate = classifyTemporalGate(game, input.nowMs);
  const engine =
    game.sport === "KBO" || game.sport === "NPB" ? baseballEngine(game.sport) : null;

  const checklist = {
    scheduleIdentityValid: game.status === "MATCHED",
    pregameTimestampValid: temporalGate === "PRE_GAME_ELIGIBLE",
    requiredTeamFeaturesAvailable: engine ? "NOT_REQUIRED_NO_ENGINE" : "NOT_APPLICABLE",
    requiredStarterFeatureAvailable: engine ? "NOT_REQUIRED_NO_ENGINE" : "NOT_APPLICABLE",
    requiredBullpenFeatureAvailable: engine ? "NOT_REQUIRED_NO_ENGINE" : "NOT_APPLICABLE",
    requiredRecentFormFeatureAvailable: engine ? "NOT_REQUIRED_NO_ENGINE" : "NOT_APPLICABLE",
    requiredLineupInput: engine ? "NOT_REQUIRED_NO_ENGINE" : "NOT_APPLICABLE",
    noPostgameLeakage: true,
    noTargetGameResult: true,
    engineVersionAlreadyApproved: engine ? false : false,
    noMarketOddsInFeatureSet: true,
    footballEngineRun: false,
    volleyballEngineInvented: false,
  };

  const passReasons: string[] = [];
  let cState: CState;

  if (game.sport === "VOLLEYBALL") {
    cState = "PASS_PROVIDER_NOT_SUPPORTED";
    passReasons.push("PASS_PROVIDER_NOT_SUPPORTED", "PASS_MISSED_PRE_GAME_WINDOW");
  } else if (temporalGate === "MISSED_PRE_GAME_WINDOW") {
    cState = "PASS_MISSED_PRE_GAME_WINDOW";
    passReasons.push("PASS_MISSED_PRE_GAME_WINDOW");
    if (game.sport === "FOOTBALL") {
      const detail = footballDetail(game);
      passReasons.push("PASS_IDENTITY_REVIEW_REQUIRED", detail.detailCode);
    }
  } else if (game.sport === "FOOTBALL") {
    cState = "PASS_IDENTITY_REVIEW_REQUIRED";
    const detail = footballDetail(game);
    passReasons.push("PASS_IDENTITY_REVIEW_REQUIRED", detail.detailCode);
  } else if (game.sport === "KBO" || game.sport === "NPB") {
    cState = "PASS_ENGINE_NOT_APPROVED";
    passReasons.push(
      "PASS_ENGINE_NOT_APPROVED",
      engine?.pipelineStatus ?? "ENGINE_PIPELINE_NOT_AVAILABLE",
    );
  } else {
    cState = "PASS_OTHER_EXPLICIT_REASON";
    passReasons.push("PASS_OTHER_EXPLICIT_REASON");
  }

  if (cState === "PREDICTION") {
    throw new Error("UNEXPECTED_PREDICTION_WITHOUT_APPROVED_ENGINE");
  }

  return {
    temporalGate,
    eligibility: "NOT_ELIGIBLE",
    cState,
    independentPrediction: { ...EMPTY_INDEPENDENT },
    eligibilityChecklist: checklist,
    passReasons,
    footballEngineRun: false,
    volleyballEngineInvented: false,
  };
}

function attachMarketBenchmark(b2Game: B2Game | undefined): {
  attached: boolean;
  marketBenchmarkOnly: true;
  predictionInput: false;
  engineInput: false;
  source: "THE_ODDS_API" | null;
  observedAt: string | null;
  sourceObservationRel: string | null;
  oddsState: string | null;
  oddsProviderEventId: string | null;
  oddsHomeTeam: string | null;
  oddsAwayTeam: string | null;
  oddsBestHome: number | null;
  oddsBestAway: number | null;
  impliedHomeProbability: number | null;
  impliedAwayProbability: number | null;
} {
  const collected = b2Game?.oddsState === "ODDS_COLLECTED";
  return {
    attached: collected,
    marketBenchmarkOnly: true,
    predictionInput: false,
    engineInput: false,
    source: collected ? "THE_ODDS_API" : null,
    observedAt: collected ? ORIGINAL_ODDS_INDEX_OBSERVED_AT : null,
    sourceObservationRel: collected ? B2_ODDS_OBS_INDEX_REL : null,
    oddsState: b2Game?.oddsState ?? null,
    oddsProviderEventId: collected ? b2Game?.oddsProviderEventId ?? null : null,
    oddsHomeTeam: collected ? b2Game?.oddsHomeTeam ?? null : null,
    oddsAwayTeam: collected ? b2Game?.oddsAwayTeam ?? null : null,
    oddsBestHome: collected ? b2Game?.oddsBestHome ?? null : null,
    oddsBestAway: collected ? b2Game?.oddsBestAway ?? null : null,
    impliedHomeProbability: collected ? b2Game?.impliedHomeProbability ?? null : null,
    impliedAwayProbability: collected ? b2Game?.impliedAwayProbability ?? null : null,
  };
}

export async function runPredictionPassReconciliation(
  cwd = process.cwd(),
  options: { predictionRunAt?: string; attachMarketBenchmark?: boolean } = {},
) {
  const predictionRunAt = options.predictionRunAt ?? new Date().toISOString();
  const predictionRunAtKst = kstStamp(predictionRunAt);
  const nowMs = Date.parse(predictionRunAt);
  const attachBench = options.attachMarketBenchmark !== false;

  const lockAbs = path.join(cwd, LOCK_REL);
  const reconAbs = path.join(cwd, RECONCILIATION_REL);
  const b2Abs = path.join(cwd, B2_COVERAGE_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  if (!existsSync(lockAbs) || !existsSync(reconAbs) || !existsSync(b2Abs)) {
    throw new Error("SEALED_SOURCE_MISSING");
  }
  if (sha256File(lockAbs) !== SEALED_LOCK_HASH) throw new Error("SEALED_SCOPE_LOCK_CHANGED");
  if (sha256File(reconAbs) !== SEALED_RECON_HASH) throw new Error("B1_RECONCILIATION_CHANGED");
  if (sha256File(b2Abs) !== SEALED_B2_COVERAGE_HASH) throw new Error("B2_COVERAGE_CHANGED");
  if (sha256File(obsAbs) !== FROZEN_OBS_HASH) throw new Error("SOURCE_OBSERVATION_CHANGED");
  if (existsSync(path.join(cwd, B2_ODDS_OBS_INDEX_REL))) {
    if (sha256File(path.join(cwd, B2_ODDS_OBS_INDEX_REL)) !== SEALED_ODDS_INDEX_HASH) {
      throw new Error("ODDS_INDEX_MUTATED");
    }
  }

  for (const rel of FORBIDDEN_PREDICTION_PATHS) {
    if (existsSync(path.join(cwd, rel))) {
      throw new Error(`EMPTY_FAKE_PREDICTION_FORBIDDEN:${rel}`);
    }
  }

  const b1 = JSON.parse(readFileSync(reconAbs, "utf8")) as {
    lockedScope: number;
    games: B1Game[];
  };
  const b2 = JSON.parse(readFileSync(b2Abs, "utf8")) as {
    games: B2Game[];
    lockedScope: number;
  };
  if (b1.lockedScope !== TOTAL_OBSERVED || b1.games.length !== TOTAL_OBSERVED) {
    throw new Error("DENOMINATOR_CHANGED");
  }

  const b2ById = new Map(b2.games.map((g) => [g.operatorGameId, g]));
  const rows = b1.games.map((game) => {
    const independent = computeIndependentDecision({ game, nowMs });
    if (independent.temporalGate === "PRE_GAME_ELIGIBLE" && independent.cState === "PREDICTION") {
      throw new Error("FAKE_PREDICTION");
    }
    if (
      independent.temporalGate === "MISSED_PRE_GAME_WINDOW" &&
      independent.cState === "PREDICTION"
    ) {
      throw new Error(`BACKDATED_PREDICTION:${game.operatorGameId}`);
    }
    const marketBenchmark = attachBench
      ? attachMarketBenchmark(b2ById.get(game.operatorGameId))
      : {
          attached: false,
          marketBenchmarkOnly: true as const,
          predictionInput: false as const,
          engineInput: false as const,
          source: null,
          observedAt: null,
          sourceObservationRel: null,
          oddsState: null,
          oddsProviderEventId: null,
          oddsHomeTeam: null,
          oddsAwayTeam: null,
          oddsBestHome: null,
          oddsBestAway: null,
          impliedHomeProbability: null,
          impliedAwayProbability: null,
        };

    return {
      operatorGameId: game.operatorGameId,
      sport: game.sport,
      rawLeagueLabel: game.rawLeagueLabel,
      rawHome: game.rawHome,
      rawAway: game.rawAway,
      canonicalHome: game.canonicalHome ?? null,
      canonicalAway: game.canonicalAway ?? null,
      displayedStartKst: game.displayedStartKst,
      displayedKickoffUtc: game.displayedKickoffUtc,
      b1IdentityState: game.status,
      b1Reasons: game.reasons ?? [],
      temporalGate: independent.temporalGate,
      eligibility: independent.eligibility,
      cState: independent.cState,
      passReasons: independent.passReasons,
      eligibilityChecklist: independent.eligibilityChecklist,
      engine: game.sport === "KBO" || game.sport === "NPB" ? baseballEngine(game.sport) : null,
      independentPrediction: independent.independentPrediction,
      marketBenchmark,
      marketOddsUsedAsPredictionInput: false,
      predictionInput: false,
      engineInput: false,
      footballEngineRun: false,
      volleyballEngineInvented: false,
      predictionCreated: false,
    };
  });

  if (rows.length !== TOTAL_OBSERVED) throw new Error("DROPPED_GAME");
  if (new Set(rows.map((r) => r.operatorGameId)).size !== rows.length) {
    throw new Error("DUPLICATE_OPERATOR_GAME");
  }

  const cStateCounts = {
    PREDICTION: rows.filter((r) => r.cState === "PREDICTION").length,
    PASS_REQUIRED_INPUT_MISSING: rows.filter((r) => r.cState === "PASS_REQUIRED_INPUT_MISSING").length,
    PASS_IDENTITY_REVIEW_REQUIRED: rows.filter((r) => r.cState === "PASS_IDENTITY_REVIEW_REQUIRED").length,
    PASS_PROVIDER_NOT_SUPPORTED: rows.filter((r) => r.cState === "PASS_PROVIDER_NOT_SUPPORTED").length,
    PASS_MISSED_PRE_GAME_WINDOW: rows.filter((r) => r.cState === "PASS_MISSED_PRE_GAME_WINDOW").length,
    PASS_ENGINE_NOT_APPROVED: rows.filter((r) => r.cState === "PASS_ENGINE_NOT_APPROVED").length,
    PASS_OTHER_EXPLICIT_REASON: rows.filter((r) => r.cState === "PASS_OTHER_EXPLICIT_REASON").length,
  };
  const cStateSum = Object.values(cStateCounts).reduce((a, b) => a + b, 0);
  if (cStateSum !== TOTAL_OBSERVED) throw new Error("C_STATE_SUM_NOT_26");
  if (cStateCounts.PREDICTION !== 0) throw new Error("UNEXPECTED_PREDICTION_COUNT");

  const reconDoc = {
    schemaVersion: "yang-edge-prediction-pass-reconciliation-v1",
    dateKst: DATE_KST,
    predictionRunAt,
    predictionRunAtKst,
    sealedMainSha: SEALED_C_MAIN_SHA,
    sourceDailyScopeLockRel: LOCK_REL,
    sourceDailyScopeLockHash: SEALED_LOCK_HASH,
    sourceB1ReconciliationRel: RECONCILIATION_REL,
    sourceB1ReconciliationHash: SEALED_RECON_HASH,
    sourceB2CoverageRel: B2_COVERAGE_REL,
    sourceB2CoverageHash: SEALED_B2_COVERAGE_HASH,
    lockedScope: TOTAL_OBSERVED,
    accountedFor: rows.length,
    predictionCount: 0,
    passCount: rows.length,
    cStateCounts,
    researchOnly: true,
    predictionInput: false,
    engineInput: false,
    marketOddsUsedAsPredictionInput: false,
    marketBenchmarkOnly: true,
    engineAdmission: "PROHIBITED",
    footballEngineRun: false,
    volleyballEngineInvented: false,
    kboEngineApproved: false,
    npbEngineApproved: false,
    providerLiveCalls: 0,
    resultCalls: 0,
    postgameCalls: 0,
    snapshotRel: C_SNAPSHOT_REL,
    officialPredictionArtifacts: [],
    futureResearchCandidate: [
      "A research-approved KBO probability engine does not exist; do not invent one from B2 coverage.",
      "A research-approved NPB probability engine does not exist; do not invent one from evidence snapshots.",
      "If a future engine requires starters, API-BASEBALL still does not expose them.",
      "Football identity/registry must be fixed before any football engine run.",
    ],
    leakage: {
      predictionCalls: 0,
      engineCalls: 0,
      resultCalls: 0,
      postgameCalls: 0,
      unauthorizedCrawling: 0,
      providerCalls: 0,
      oddsUsedAsModelFeatures: false,
      denominatorChanged: false,
      gamesDropped: false,
      historicalPredictionRewrite: false,
      footballEngineRun: false,
    },
    games: rows,
  };

  const reconHash = await writeJson(C_RECON_REL, reconDoc, cwd);

  const snapshotDoc = {
    schemaVersion: "yang-edge-pregame-prediction-snapshot-v1",
    dateKst: DATE_KST,
    snapshotKind: "PRE_GAME_C_PASS_SNAPSHOT",
    immutableAfterSeal: true,
    predictionRunAt,
    predictionRunAtKst,
    lockedScope: TOTAL_OBSERVED,
    accountedFor: rows.length,
    predictionCount: 0,
    passCount: rows.length,
    cStateCounts,
    sourceDailyScopeLockHash: SEALED_LOCK_HASH,
    sourceB1ReconciliationHash: SEALED_RECON_HASH,
    sourceB2CoverageHash: SEALED_B2_COVERAGE_HASH,
    predictionPassReconciliationRel: C_RECON_REL,
    predictionPassReconciliationHash: reconHash.sha256,
    officialPredictionArtifactHashes: [],
    engineVersion: null,
    kboEnginePolicy: KBO_ENGINE_POLICY,
    npbEnginePolicy: NPB_ENGINE_POLICY,
    marketOddsUsedAsPredictionInput: false,
    result: "NONE",
    grade: "NONE",
    postgame: "NONE",
    games: rows.map((r) => ({
      operatorGameId: r.operatorGameId,
      sport: r.sport,
      displayedKickoffUtc: r.displayedKickoffUtc,
      temporalGate: r.temporalGate,
      cState: r.cState,
      predictionCreated: false,
    })),
  };
  const snapshotHash = await writeJson(C_SNAPSHOT_REL, snapshotDoc, cwd);

  return {
    reconRel: reconHash.rel,
    reconSha256: reconHash.sha256,
    snapshotRel: snapshotHash.rel,
    snapshotSha256: snapshotHash.sha256,
    document: reconDoc,
    liveProviderCalls: 0,
  };
}

async function main() {
  const result = await runPredictionPassReconciliation();
  const c = result.document;
  console.log(
    JSON.stringify(
      {
        reconRel: result.reconRel,
        reconSha256: result.reconSha256,
        snapshotRel: result.snapshotRel,
        snapshotSha256: result.snapshotSha256,
        predictionRunAt: c.predictionRunAt,
        predictionRunAtKst: c.predictionRunAtKst,
        lockedScope: c.lockedScope,
        accountedFor: c.accountedFor,
        predictionCount: c.predictionCount,
        passCount: c.passCount,
        cStateCounts: c.cStateCounts,
        providerLiveCalls: c.providerLiveCalls,
        marketOddsUsedAsPredictionInput: c.marketOddsUsedAsPredictionInput,
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
