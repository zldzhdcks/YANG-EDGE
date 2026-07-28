/**
 * KBO Today Slate Readiness v1
 *
 * Read-only audit over:
 * - existing KBO identity artifact
 * - optional operator input files
 *
 * If identity artifact is missing, instruct operator to run:
 *   npm run research:kbo-identity -- YYYY-MM-DD
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import { getKboIdentityArtifactPath } from "../src/lib/kbo/kbo-identity-artifact-path";
import { getKboIdentityProvider } from "../src/lib/kbo/kbo-identity-feature-flag";

type CoverageStatus =
  | "FULL_COVERAGE"
  | "PARTIAL_COVERAGE"
  | "NO_COVERAGE"
  | "UNKNOWN_EXPECTED_SLATE";

type MappingStatus = "MATCHED" | "UNMATCHED" | "AMBIGUOUS" | "NOT_CHECKED";
type DataStatus =
  | "COLLECTED"
  | "PARTIAL"
  | "NOT_COLLECTED"
  | "NOT_SUPPORTED"
  | "FUTURE_GATED";
type BetmanScopeStatus = "NOT_ENTERED" | "ENTERED";
type OddsInputStatus = "NOT_ENTERED" | "ENTERED";
type AnalysisReadiness =
  | "IDENTITY_ONLY"
  | "MARKET_INPUT_PENDING"
  | "RESEARCH_INPUTS_PARTIAL"
  | "READY_FOR_RESEARCH_SNAPSHOT_AUDIT"
  | "STARTER_INPUT_VERIFIED"
  | "READY_FOR_PREDICTION";

type IdentityRow = {
  internalGameId: string;
  homeTeam: { canonicalNameKo: string | null; mappingStatus: MappingStatus };
  awayTeam: { canonicalNameKo: string | null; mappingStatus: MappingStatus };
  time: { startTimeKst: string | null };
  providerStatusRaw: string | null;
  gameStatus?: string | null;
  result: {
    resultStatus: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    winner?: string | null;
  };
};

type IdentityDocument = {
  meta: {
    dateKst: string;
    resultHashSha256: string;
    legalStatus: string;
  };
  warnings?: string[];
  summary: {
    providerGamesFetched: number;
    datasetGamesCreated: number;
    teamMappingsMatched: number;
    teamMappingsUnmatched: number;
    final?: number;
    draw?: number;
    postponed?: number;
    cancelled?: number;
    noGame?: number;
    suspended?: number;
  };
  rows: IdentityRow[];
};

type OperatorInputAudit = {
  inputReadyStatus?: string;
};

type OperatorStarterInputAudit = {
  inputStatus?: string;
};

type OperatorMarketsV2Audit = {
  inputStatus?: string;
  gamesEntered?: number;
  marketsEntered?: number;
};

type OperatorScopeGame = {
  operatorGameId?: string;
  homeTeamText?: string;
  awayTeamText?: string;
  marketTypes?: string[];
  mappingStatus?: MappingStatus;
  matchedInternalGameId?: string | null;
  notes?: string;
};

type ProtoOddsGame = {
  operatorGameId?: string;
  matchedInternalGameId?: string | null;
  marketType?: string;
  selection?: string;
  odds?: number | string;
  inputMethod?: "MANUAL" | "OCR_REVIEWED";
  reviewStatus?: "DRAFT" | "VERIFIED" | "REJECTED";
  notes?: string;
};

function todayOrArg(): string {
  return process.argv[2]?.trim() || getKstToday();
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function providerCoverageStatus(identity: IdentityDocument): CoverageStatus {
  const warnings = identity.warnings ?? [];
  if (identity.summary.providerGamesFetched === 0) return "NO_COVERAGE";
  if (
    identity.summary.providerGamesFetched >= 5 &&
    identity.summary.datasetGamesCreated >= 5 &&
    !warnings.some((w) => w.includes("PROVIDER_LIMITED_COVERAGE"))
  ) {
    return "FULL_COVERAGE";
  }
  if (
    warnings.some((w) => w.includes("PROVIDER_LIMITED_COVERAGE")) ||
    identity.summary.providerGamesFetched <= 3
  ) {
    return "PARTIAL_COVERAGE";
  }
  return "UNKNOWN_EXPECTED_SLATE";
}

function availabilityBase(): Record<string, DataStatus> {
  return {
    identity: "COLLECTED",
    schedule: "COLLECTED",
    resultStatus: "COLLECTED",
    starter: "FUTURE_GATED",
    bullpen: "FUTURE_GATED",
    lineup: "FUTURE_GATED",
    travelRest: "FUTURE_GATED",
    weather: "FUTURE_GATED",
    injury: "FUTURE_GATED",
    odds: "NOT_COLLECTED",
    predictionSnapshot: "FUTURE_GATED",
  };
}

function buildBlockingReasons(args: {
  coverage: CoverageStatus;
  betmanScopeStatus: BetmanScopeStatus;
  oddsInputStatus: OddsInputStatus;
}): string[] {
  const reasons: string[] = [];
  if (args.coverage === "PARTIAL_COVERAGE") {
    reasons.push("PROVIDER_PARTIAL_COVERAGE");
  }
  if (args.betmanScopeStatus === "NOT_ENTERED") {
    reasons.push("BETMAN_SCOPE_NOT_ENTERED");
  }
  if (args.oddsInputStatus === "NOT_ENTERED") {
    reasons.push("PROTO_ODDS_NOT_ENTERED");
  }
  reasons.push("STARTER_NOT_COLLECTED");
  reasons.push("BULLPEN_NOT_COLLECTED");
  reasons.push("LINEUP_NOT_COLLECTED");
  reasons.push("INJURY_NOT_COLLECTED");
  reasons.push("PREDICTION_PIPELINE_NOT_IMPLEMENTED");
  reasons.push("LEGAL_CLEARANCE_PENDING");
  return reasons;
}

function buildReadiness(args: {
  identityGames: number;
  betmanScopeStatus: BetmanScopeStatus;
  oddsInputStatus: OddsInputStatus;
}): AnalysisReadiness {
  if (args.identityGames === 0) return "IDENTITY_ONLY";
  if (
    args.betmanScopeStatus === "NOT_ENTERED" &&
    args.oddsInputStatus === "NOT_ENTERED"
  ) {
    return "IDENTITY_ONLY";
  }
  if (args.oddsInputStatus === "NOT_ENTERED") return "MARKET_INPUT_PENDING";
  if (args.betmanScopeStatus === "ENTERED") return "RESEARCH_INPUTS_PARTIAL";
  return "IDENTITY_ONLY";
}

async function main() {
  const dateKst = todayOrArg();
  const cwd = process.cwd();
  const identityProvider = getKboIdentityProvider();
  const identityPath = getKboIdentityArtifactPath(
    dateKst,
    identityProvider,
    cwd,
  );

  const identity = await readJsonIfExists<IdentityDocument>(identityPath);
  if (!identity) {
    console.log(`=== KBO Today Slate Readiness (${dateKst}) ===`);
    console.log("Identity artifact: MISSING");
    console.log(`Run first: npm run research:kbo-identity -- ${dateKst}`);
    return;
  }

  const betmanPath = path.join(
    cwd,
    "data/operator-input/kbo",
    `${dateKst}-betman-scope.json`,
  );
  const protoOddsPath = path.join(
    cwd,
    "data/operator-input/kbo",
    `${dateKst}-proto-odds.json`,
  );
  const operatorAuditPath = path.join(
    cwd,
    "data/audits",
    `${dateKst}-kbo-operator-input-v1-audit.json`,
  );
  const operatorMarketsV2AuditPath = path.join(
    cwd,
    "data/audits",
    `${dateKst}-kbo-operator-markets-v2-audit.json`,
  );
  const starterOperatorAuditPath = path.join(
    cwd,
    "data/audits",
    `${dateKst}-kbo-starter-operator-input-v1-audit.json`,
  );

  const betmanInput = await readJsonIfExists<{ games?: OperatorScopeGame[] }>(
    betmanPath,
  );
  const protoOddsInput = await readJsonIfExists<{ games?: ProtoOddsGame[] }>(
    protoOddsPath,
  );
  const operatorAudit = await readJsonIfExists<OperatorInputAudit>(
    operatorAuditPath,
  );
  const operatorMarketsV2Audit =
    await readJsonIfExists<OperatorMarketsV2Audit>(operatorMarketsV2AuditPath);
  const starterOperatorAudit =
    await readJsonIfExists<OperatorStarterInputAudit>(starterOperatorAuditPath);

  const hasV2OperatorInput =
    (operatorMarketsV2Audit?.gamesEntered ?? 0) > 0 ||
    (operatorMarketsV2Audit?.marketsEntered ?? 0) > 0;
  const betmanScopeStatus: BetmanScopeStatus =
    hasV2OperatorInput || betmanInput ? "ENTERED" : "NOT_ENTERED";
  const oddsInputStatus: OddsInputStatus =
    hasV2OperatorInput || protoOddsInput ? "ENTERED" : "NOT_ENTERED";
  const coverage = providerCoverageStatus(identity);
  let readiness = buildReadiness({
    identityGames: identity.summary.datasetGamesCreated,
    betmanScopeStatus,
    oddsInputStatus,
  });
  if (operatorMarketsV2Audit?.inputStatus === "VERIFIED_FOR_RESEARCH_INPUT") {
    readiness = "READY_FOR_RESEARCH_SNAPSHOT_AUDIT";
  } else if (
    operatorMarketsV2Audit?.inputStatus === "READY_FOR_OPERATOR_REVIEW" ||
    operatorMarketsV2Audit?.inputStatus === "PARTIALLY_MAPPED" ||
    operatorMarketsV2Audit?.inputStatus === "DRAFT"
  ) {
    readiness = "RESEARCH_INPUTS_PARTIAL";
  } else if (operatorAudit?.inputReadyStatus === "VERIFIED_FOR_RESEARCH_INPUT") {
    readiness = "READY_FOR_RESEARCH_SNAPSHOT_AUDIT";
  } else if (
    operatorAudit?.inputReadyStatus === "READY_FOR_OPERATOR_REVIEW" ||
    operatorAudit?.inputReadyStatus === "PARTIALLY_MAPPED"
  ) {
    readiness = "RESEARCH_INPUTS_PARTIAL";
  } else if (operatorAudit?.inputReadyStatus === "DRAFT") {
    readiness = "MARKET_INPUT_PENDING";
  }
  if (starterOperatorAudit?.inputStatus === "VERIFIED_FOR_RESEARCH_INPUT") {
    readiness = "STARTER_INPUT_VERIFIED";
  } else if (
    starterOperatorAudit?.inputStatus === "DRAFT" ||
    starterOperatorAudit?.inputStatus === "PARTIALLY_VERIFIED"
  ) {
    if (readiness === "IDENTITY_ONLY") {
      readiness = "RESEARCH_INPUTS_PARTIAL";
    }
  }
  const blockingReasons = buildBlockingReasons({
    coverage,
    betmanScopeStatus,
    oddsInputStatus,
  });

  const knownGames = identity.rows.map((row) => ({
    internalGameId: row.internalGameId,
    homeTeam: row.homeTeam.canonicalNameKo ?? row.homeTeam.mappingStatus,
    awayTeam: row.awayTeam.canonicalNameKo ?? row.awayTeam.mappingStatus,
    startTimeKst: row.time.startTimeKst,
    providerStatusRaw: row.providerStatusRaw,
    resultStatus: row.result.resultStatus,
  }));

  const missingGames =
    coverage === "PARTIAL_COVERAGE"
      ? ["UNKNOWN_DUE_TO_PARTIAL_PROVIDER_COVERAGE"]
      : [];

  const teamMappings = identity.rows.map((row) => ({
    internalGameId: row.internalGameId,
    homeTeamMapping: row.homeTeam.mappingStatus,
    awayTeamMapping: row.awayTeam.mappingStatus,
  }));

  const gameStatuses = identity.rows.map((row) => ({
    internalGameId: row.internalGameId,
    providerStatusRaw: row.providerStatusRaw,
    gameStatus: row.gameStatus ?? null,
    resultStatus: row.result.resultStatus,
  }));

  const resultCoverage = {
    finalGames: identity.summary.final ?? 0,
    drawGames: identity.summary.draw ?? 0,
    pendingGames: identity.rows.filter(
      (row) => row.result.resultStatus === "PENDING",
    ).length,
    postponedGames: identity.summary.postponed ?? 0,
    cancelledGames: identity.summary.cancelled ?? 0,
    noGameGames: identity.summary.noGame ?? 0,
    suspendedGames: identity.summary.suspended ?? 0,
    inconclusiveGames: identity.rows.filter(
      (row) => row.result.resultStatus === "INCONCLUSIVE",
    ).length,
    specialStatusGames: identity.rows.filter((row) =>
      [
        "POSTPONED",
        "CANCELLED",
        "NO_GAME",
        "SUSPENDED",
        "INCONCLUSIVE",
        "UNKNOWN",
      ].includes(row.gameStatus ?? ""),
    ).length,
    scoresResolved: identity.rows.filter(
      (row) => row.result.homeScore != null && row.result.awayScore != null,
    ).length,
    winnersResolved: identity.rows.filter(
      (row) =>
        row.result.winner === "HOME" ||
        row.result.winner === "AWAY" ||
        row.result.winner === "DRAW",
    ).length,
  };

  const startTimes = identity.rows.map((row) => ({
    internalGameId: row.internalGameId,
    startTimeKst: row.time.startTimeKst,
  }));

  const analysisAvailability = identity.rows.map((row) => {
    const base = availabilityBase();
    if (starterOperatorAudit?.inputStatus === "VERIFIED_FOR_RESEARCH_INPUT") {
      base.starter = "COLLECTED";
    } else if (
      starterOperatorAudit?.inputStatus === "DRAFT" ||
      starterOperatorAudit?.inputStatus === "PARTIALLY_VERIFIED"
    ) {
      base.starter = "PARTIAL";
    }
    return {
      internalGameId: row.internalGameId,
      ...base,
    };
  });

  const audit = {
    meta: {
      version: "kbo-today-slate-readiness-v1",
      generatedAt: new Date().toISOString(),
      conclusion: "KBO_TODAY_SLATE_READINESS_CREATED",
    },
    targetDateKst: dateKst,
    expectedKboGames: "UNKNOWN",
    providerGamesFetched: identity.summary.providerGamesFetched,
    identityGamesCreated: identity.summary.datasetGamesCreated,
    providerCoverageStatus: coverage,
    knownGames,
    missingGames,
    teamMappings,
    startTimes,
    gameStatuses,
    resultCoverage,
    betmanScopeStatus,
    oddsInputStatus,
    analysisReadiness: readiness,
    analysisAvailability,
    blockingReasons,
    legalStatus: {
      kboData: "INTERNAL_RESEARCH_ONLY",
      publicCommercial: "LEGAL_CLEARANCE_PENDING",
      betman: "MANUAL_SCOPE_ONLY",
      protoOdds: "MANUAL_INPUT_ONLY",
    },
    operatorInputFiles: {
      betmanScopePath: betmanPath,
      protoOddsPath,
      operatorAuditPath,
      operatorMarketsV2AuditPath,
      starterOperatorAuditPath,
      identityProvider,
      betmanEntered: betmanInput != null,
      protoOddsEntered: protoOddsInput != null,
      operatorAuditStatus: operatorAudit?.inputReadyStatus ?? "NOT_ENTERED",
      operatorMarketsV2AuditStatus:
        operatorMarketsV2Audit?.inputStatus ?? "NOT_ENTERED",
      starterOperatorInputAuditStatus:
        starterOperatorAudit?.inputStatus ?? "NOT_ENTERED",
    },
    kboIdentityResultHash: identity.meta.resultHashSha256,
  };

  const outPath = path.join(
    cwd,
    "data/audits",
    `${dateKst}-kbo-today-slate-readiness-v1.json`,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log(`=== KBO Today Slate Readiness (${dateKst}) ===`);
  console.log("");
  console.log("Provider coverage:");
  console.log(coverage);
  console.log("");
  console.log("Identity games:");
  console.log(String(identity.summary.datasetGamesCreated));
  console.log("");
  console.log("Result coverage:");
  console.log(
    `final=${resultCoverage.finalGames} pending=${resultCoverage.pendingGames} special=${resultCoverage.specialStatusGames}`,
  );
  console.log("");
  console.log("Betman scope:");
  console.log(betmanScopeStatus);
  console.log("");
  console.log("Proto odds:");
  console.log(oddsInputStatus);
  console.log("");
  console.log("Analysis readiness:");
  console.log(readiness);
  console.log("");
  console.log("Blocking reasons:");
  for (const reason of blockingReasons) {
    console.log(`- ${reason}`);
  }
  console.log("");
  console.log("찬양님이 다음에 해야 할 일:");
  console.log("1. 배트맨 편성 경기 수동 확인");
  console.log("2. 대상 경기 입력");
  console.log("3. 배당 수동 입력");
  console.log("4. 완료 후 readiness 재실행");
  console.log("");
  console.log(`Audit: ${outPath}`);
  console.log("KBO_TODAY_SLATE_READINESS_CREATED");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
