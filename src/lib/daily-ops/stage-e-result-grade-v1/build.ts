/**
 * Daily Stage E Result + Grade builder for locked-scope games.
 *
 * Reads C / B1 / Snapshot (immutable). Collects Result via existing providers.
 * Does not write Pregame / C / Prediction / Engine artifacts.
 * PASS → NOT_GRADABLE. predictionHit stays null.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractApiFootballResultScores } from "../../football/official-result-v0/extract-scores";
import {
  isApiFootballTerminalFinalShort,
  mapApiFootballShortStatusToResultStatus,
} from "../../football/official-result-v0/map-provider-status";
import { isFinalStatus } from "../../football/result-foundation-v0/derive-one-x-two-outcome";
import type { FixtureRaw } from "../../football/types";
import {
  createKboCacheUsage,
  getKboApiBaseballJson,
} from "../../kbo/kbo-api-baseball-cache";
import { getFootballProvider, resolveFootballProviderKind } from "../../football/get-football-provider";
import {
  baseballGameStatusToResultState,
  isBaseballTerminalFinal,
  mapApiBaseballStatusToKboGameStatus,
} from "./map-baseball-status";
import {
  STAGE_E_B1_REL,
  STAGE_E_C_RECONCILIATION_REL,
  STAGE_E_C_RECONCILIATION_SHA256,
  STAGE_E_DATE_KST,
  STAGE_E_SNAPSHOT_REL,
  STAGE_E_SNAPSHOT_SHA256,
} from "./paths";
import {
  DAILY_STAGE_E_GRADE_REASON,
  DAILY_STAGE_E_GRADE_STATUS,
  DAILY_STAGE_E_RESULT_GRADE_SCHEMA,
  DAILY_STAGE_E_CLOSE_CONTRACT_V2,
  type DailyStageEGameRowV1,
  type DailyStageEProviderCall,
  type DailyStageEResultGradeCloseV1,
  type DailyStageEResultIdentityState,
  type DailyStageEResultState,
  type StageEB1Game,
  type StageECgame,
} from "./types";
import {
  attachStageECloseV2,
  deriveDailyStageEStageResult,
  deriveDailyStageEStatusFromCloseClasses,
  loadStageETerminalGapContext,
} from "./terminal-coverage-gap-v2";

export type { StageEB1Game, StageECgame } from "./types";

export type StageEBaseballGameNorm = {
  providerGameId: string;
  providerStatusRaw: string | null;
  homeTeamProviderId: string | null;
  awayTeamProviderId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type StageESources = {
  cGames: StageECgame[];
  b1ByOperatorId: Map<string, StageEB1Game>;
  cHash: string;
  snapshotHash: string;
  cPredictionCount: number;
  cPassCount: number;
  cLockedScope: number;
};

export type StageECollectInput = {
  cwd?: string;
  dateKst?: string;
  resultRunAt: string;
  baseballGames?: {
    kbo: StageEBaseballGameNorm[];
    npb: StageEBaseballGameNorm[];
  };
  footballFixtures?: Map<string, FixtureRaw>;
  fetchLive?: boolean;
};

function stripCloseClassification(
  row: DailyStageEGameRowV1,
): Omit<
  DailyStageEGameRowV1,
  | "closeClass"
  | "exactResultLookupAvailable"
  | "coverageGapClass"
  | "coverageGapReasons"
  | "coverageGapEvidence"
  | "pregameIdentityProvenance"
  | "fuzzyMatchingUsed"
> {
  const {
    closeClass: _closeClass,
    exactResultLookupAvailable: _exact,
    coverageGapClass: _gap,
    coverageGapReasons: _reasons,
    coverageGapEvidence: _evidence,
    pregameIdentityProvenance: _prov,
    fuzzyMatchingUsed: _fuzzy,
    ...observation
  } = row;
  return observation;
}

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asId(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export function parseApiBaseballGamesPayload(body: unknown): StageEBaseballGameNorm[] {
  const response = (body as { response?: unknown } | null)?.response;
  const rows = Array.isArray(response) ? response : Array.isArray(body) ? body : [];
  const out: StageEBaseballGameNorm[] = [];
  for (const row of rows) {
    const g = row as {
      id?: unknown;
      status?: { short?: unknown };
      teams?: { home?: { id?: unknown }; away?: { id?: unknown } };
      scores?: { home?: { total?: unknown }; away?: { total?: unknown } };
    };
    const providerGameId = asId(g.id);
    if (!providerGameId) continue;
    out.push({
      providerGameId,
      providerStatusRaw: typeof g.status?.short === "string" ? g.status.short : null,
      homeTeamProviderId: asId(g.teams?.home?.id),
      awayTeamProviderId: asId(g.teams?.away?.id),
      homeScore: asNumber(g.scores?.home?.total),
      awayScore: asNumber(g.scores?.away?.total),
    });
  }
  return out;
}

export async function loadStageESources(cwd = process.cwd()): Promise<StageESources> {
  const cRaw = await readFile(path.join(cwd, STAGE_E_C_RECONCILIATION_REL), "utf8");
  const snapRaw = await readFile(path.join(cwd, STAGE_E_SNAPSHOT_REL), "utf8");
  const b1Raw = await readFile(path.join(cwd, STAGE_E_B1_REL), "utf8");
  const cHash = sha256Text(cRaw);
  const snapshotHash = sha256Text(snapRaw);
  if (cHash !== STAGE_E_C_RECONCILIATION_SHA256) {
    throw new Error(`STAGE_E_C_HASH_MISMATCH: ${cHash}`);
  }
  if (snapshotHash !== STAGE_E_SNAPSHOT_SHA256) {
    throw new Error(`STAGE_E_SNAPSHOT_HASH_MISMATCH: ${snapshotHash}`);
  }
  const cDoc = JSON.parse(cRaw) as {
    lockedScope: number;
    predictionCount: number;
    passCount: number;
    games: StageECgame[];
  };
  const b1Doc = JSON.parse(b1Raw) as { games: StageEB1Game[] };
  if (cDoc.lockedScope !== 26 || cDoc.games.length !== 26) {
    throw new Error("STAGE_E_LOCKED_SCOPE_NOT_26");
  }
  if (cDoc.predictionCount !== 0 || cDoc.passCount !== 26) {
    throw new Error("STAGE_E_C_PREDICTION_PASS_MISMATCH");
  }
  const b1ByOperatorId = new Map<string, StageEB1Game>();
  for (const row of b1Doc.games) {
    b1ByOperatorId.set(row.operatorGameId, row);
  }
  return {
    cGames: cDoc.games,
    b1ByOperatorId,
    cHash,
    snapshotHash,
    cPredictionCount: cDoc.predictionCount,
    cPassCount: cDoc.passCount,
    cLockedScope: cDoc.lockedScope,
  };
}

function notGradableRow(
  game: StageECgame,
  extra: Omit<
    DailyStageEGameRowV1,
    | "operatorGameId"
    | "sport"
    | "league"
    | "cState"
    | "predictionCreated"
    | "gradeState"
    | "predictionHit"
    | "gradeReason"
    | "closeClass"
    | "exactResultLookupAvailable"
    | "coverageGapClass"
    | "coverageGapReasons"
    | "coverageGapEvidence"
    | "pregameIdentityProvenance"
    | "fuzzyMatchingUsed"
  >,
): Omit<
  DailyStageEGameRowV1,
  | "closeClass"
  | "exactResultLookupAvailable"
  | "coverageGapClass"
  | "coverageGapReasons"
  | "coverageGapEvidence"
  | "pregameIdentityProvenance"
  | "fuzzyMatchingUsed"
> {
  if (game.independentPrediction?.created === true) {
    throw new Error(`STAGE_E_PASS_ROW_HAS_PREDICTION: ${game.operatorGameId}`);
  }
  return {
    operatorGameId: game.operatorGameId,
    sport: game.sport,
    league: game.rawLeagueLabel,
    cState: game.cState,
    predictionCreated: false,
    gradeState: DAILY_STAGE_E_GRADE_STATUS,
    predictionHit: null,
    gradeReason: DAILY_STAGE_E_GRADE_REASON,
    ...extra,
  };
}

function joinBaseball(
  b1: StageEB1Game | undefined,
  games: StageEBaseballGameNorm[],
): {
  identity: DailyStageEResultIdentityState;
  hit: StageEBaseballGameNorm | null;
  missingCurrentPayload: boolean;
} {
  const fixtureId = b1?.providerFixtureId ?? null;
  if (!fixtureId) {
    return { identity: "IDENTITY_UNRESOLVED", hit: null, missingCurrentPayload: false };
  }
  const matches = games.filter((g) => g.providerGameId === fixtureId);
  if (matches.length !== 1) {
    return { identity: "MATCHED", hit: null, missingCurrentPayload: true };
  }
  const hit = matches[0]!;
  if (b1?.providerHomeTeamId && hit.homeTeamProviderId !== b1.providerHomeTeamId) {
    return { identity: "IDENTITY_UNRESOLVED", hit: null, missingCurrentPayload: false };
  }
  if (b1?.providerAwayTeamId && hit.awayTeamProviderId !== b1.providerAwayTeamId) {
    return { identity: "IDENTITY_UNRESOLVED", hit: null, missingCurrentPayload: false };
  }
  return { identity: "MATCHED", hit, missingCurrentPayload: false };
}

function baseballRow(
  game: StageECgame,
  b1: StageEB1Game | undefined,
  games: StageEBaseballGameNorm[],
  resultRunAt: string,
): Omit<
  DailyStageEGameRowV1,
  | "closeClass"
  | "exactResultLookupAvailable"
  | "coverageGapClass"
  | "coverageGapReasons"
  | "coverageGapEvidence"
  | "pregameIdentityProvenance"
  | "fuzzyMatchingUsed"
> {
  const joined = joinBaseball(b1, games);
  if (joined.identity !== "MATCHED") {
    return notGradableRow(game, {
      resultIdentityState: "IDENTITY_UNRESOLVED",
      providerFixtureId: b1?.providerFixtureId ?? null,
      resultState: "IDENTITY_UNRESOLVED",
      homeScore: null,
      awayScore: null,
      resultProvider: b1?.providerFixtureId ? "API_BASEBALL" : null,
      resultObservedAt: null,
      providerStatusRaw: null,
    });
  }
  if (!joined.hit) {
    return notGradableRow(game, {
      resultIdentityState: "MATCHED",
      providerFixtureId: b1?.providerFixtureId ?? null,
      resultState: "NOT_RESOLVED",
      homeScore: null,
      awayScore: null,
      resultProvider: "API_BASEBALL",
      resultObservedAt: resultRunAt,
      providerStatusRaw: null,
    });
  }
  const status = mapApiBaseballStatusToKboGameStatus(joined.hit.providerStatusRaw);
  const resultState = baseballGameStatusToResultState(
    status,
    joined.hit.providerStatusRaw,
  );
  const terminalFinal = isBaseballTerminalFinal(status) && resultState === "FINAL";
  return notGradableRow(game, {
    resultIdentityState: "MATCHED",
    providerFixtureId: joined.hit.providerGameId,
    resultState,
    homeScore: terminalFinal ? joined.hit.homeScore : null,
    awayScore: terminalFinal ? joined.hit.awayScore : null,
    resultProvider: "API_BASEBALL",
    resultObservedAt: resultRunAt,
    providerStatusRaw: joined.hit.providerStatusRaw,
  });
}

function footballRow(
  game: StageECgame,
  b1: StageEB1Game | undefined,
  fixtures: Map<string, FixtureRaw>,
  resultRunAt: string,
): Omit<
  DailyStageEGameRowV1,
  | "closeClass"
  | "exactResultLookupAvailable"
  | "coverageGapClass"
  | "coverageGapReasons"
  | "coverageGapEvidence"
  | "pregameIdentityProvenance"
  | "fuzzyMatchingUsed"
> {
  const fixtureId = b1?.providerFixtureId ?? null;
  if (!fixtureId) {
    return notGradableRow(game, {
      resultIdentityState: "IDENTITY_UNRESOLVED",
      providerFixtureId: null,
      resultState: "IDENTITY_UNRESOLVED",
      homeScore: null,
      awayScore: null,
      resultProvider: null,
      resultObservedAt: null,
      providerStatusRaw: null,
    });
  }
  const fixture = fixtures.get(fixtureId);
  if (!fixture) {
    return notGradableRow(game, {
      resultIdentityState: "MATCHED",
      providerFixtureId: fixtureId,
      resultState: "NOT_RESOLVED",
      homeScore: null,
      awayScore: null,
      resultProvider: "API_FOOTBALL",
      resultObservedAt: null,
      providerStatusRaw: null,
    });
  }
  const homeId = asId(fixture.teams?.home?.id);
  const awayId = asId(fixture.teams?.away?.id);
  if (b1?.providerHomeTeamId && homeId !== b1.providerHomeTeamId) {
    return notGradableRow(game, {
      resultIdentityState: "IDENTITY_UNRESOLVED",
      providerFixtureId: fixtureId,
      resultState: "IDENTITY_UNRESOLVED",
      homeScore: null,
      awayScore: null,
      resultProvider: "API_FOOTBALL",
      resultObservedAt: resultRunAt,
      providerStatusRaw: fixture.fixture?.status?.short ?? null,
    });
  }
  if (b1?.providerAwayTeamId && awayId !== b1.providerAwayTeamId) {
    return notGradableRow(game, {
      resultIdentityState: "IDENTITY_UNRESOLVED",
      providerFixtureId: fixtureId,
      resultState: "IDENTITY_UNRESOLVED",
      homeScore: null,
      awayScore: null,
      resultProvider: "API_FOOTBALL",
      resultObservedAt: resultRunAt,
      providerStatusRaw: fixture.fixture?.status?.short ?? null,
    });
  }
  const rawShort = fixture.fixture?.status?.short ?? null;
  const mapped = mapApiFootballShortStatusToResultStatus(rawShort);
  let resultState: DailyStageEResultState = "NOT_RESOLVED";
  if (isFinalStatus(mapped)) resultState = "FINAL";
  else if (mapped === "LIVE" || mapped === "HALFTIME") resultState = "LIVE";
  else if (mapped === "SCHEDULED") resultState = "SCHEDULED";
  else if (mapped === "POSTPONED") resultState = "POSTPONED";
  else if (mapped === "CANCELLED") resultState = "CANCELLED";
  else if (mapped === "ABANDONED") resultState = "ABANDONED";
  else if (mapped === "SUSPENDED") resultState = "SUSPENDED";

  const scores = extractApiFootballResultScores(fixture);
  const allowScore = isApiFootballTerminalFinalShort(rawShort);
  return notGradableRow(game, {
    resultIdentityState: "MATCHED",
    providerFixtureId: fixtureId,
    resultState,
    homeScore: allowScore ? scores.regularTime.home ?? scores.finalScore.home : null,
    awayScore: allowScore ? scores.regularTime.away ?? scores.finalScore.away : null,
    resultProvider: "API_FOOTBALL",
    resultObservedAt: resultRunAt,
    providerStatusRaw: rawShort,
  });
}

function apiBaseballPlanBlocked(body: unknown): boolean {
  const errors = (body as { errors?: unknown } | null)?.errors;
  if (errors == null) return false;
  if (Array.isArray(errors) && errors.length === 0) return false;
  const text = JSON.stringify(errors).toLowerCase();
  return text.includes("plan") || text.includes("season");
}

async function fetchApiBaseballGamesByIds(input: {
  cwd: string;
  ids: string[];
  sport: string;
}): Promise<{
  games: StageEBaseballGameNorm[];
  calls: DailyStageEProviderCall[];
  blocked: boolean;
}> {
  const apiKey =
    process.env.BASEBALL_API_KEY?.trim() ||
    process.env.FOOTBALL_API_KEY?.trim() ||
    "";
  const baseUrl =
    process.env.BASEBALL_API_BASE_URL?.trim() ||
    "https://v1.baseball.api-sports.io";
  if (!apiKey) {
    throw new Error("STAGE_E_BASEBALL_API_KEY_MISSING");
  }
  const games: StageEBaseballGameNorm[] = [];
  const calls: DailyStageEProviderCall[] = [];
  for (const id of input.ids) {
    const endpoint = `games?id=${id}`;
    const usage = createKboCacheUsage();
    const body = await getKboApiBaseballJson(
      endpoint,
      usage,
      { baseUrl, apiKey },
      input.cwd,
      { forceRefresh: false },
    );
    const liveCall = usage.networkCalls > 0;
    const blocked = apiBaseballPlanBlocked(body);
    calls.push({
      provider: "API_BASEBALL",
      endpoint: `/${endpoint}`,
      purpose: `${input.sport} official result by exact providerGameId`,
      sport: input.sport,
      fixtureId: id,
      cacheMissReason: blocked
        ? "PROVIDER_SEASON_NOT_ACCESSIBLE"
        : liveCall
          ? "RESULT_COLLECTION_CACHE_MISS"
          : "RESULT_ID_CACHE_HIT",
      liveCall,
    });
    if (blocked) {
      return { games, calls, blocked: true };
    }
    games.push(...parseApiBaseballGamesPayload(body));
  }
  return { games, calls, blocked: false };
}

/**
 * v2: operational close is not full FINAL coverage.
 * Historical 2026-08-22 required every scoped game FINAL; that remains true
 * for that sealed day and is not rewritten.
 */
export function deriveDailyStageEStatus(
  games: DailyStageEGameRowV1[],
): DailyStageEResultGradeCloseV1["eStatus"] {
  return deriveDailyStageEStatusFromCloseClasses(games);
}

function pendingLike(g: DailyStageEGameRowV1): boolean {
  return (
    g.resultState === "LIVE" ||
    g.resultState === "SCHEDULED" ||
    g.resultState === "PENDING" ||
    g.resultState === "NOT_RESOLVED" ||
    g.closeClass === "ACTIVE_RESULT_PENDING"
  );
}

function assembleCloseAggregates(
  doc: Omit<
    DailyStageEResultGradeCloseV1,
    | "lockedScope"
    | "scopeTotal"
    | "accountedFor"
    | "predictionCount"
    | "passCount"
    | "gradedPredictionCount"
    | "gradedPredictions"
    | "finalResultCount"
    | "pendingResultCount"
    | "unsupportedResultCount"
    | "unresolvedResultCount"
    | "postponedCancelledAbandonedCount"
    | "liveResultCount"
    | "scheduledResultCount"
    | "operationallyClosedCount"
    | "activePendingCount"
    | "terminalCoverageGapCount"
    | "identityCoverageGapCount"
    | "unsupportedCoverageGapCount"
    | "resultCoverage"
    | "credit"
    | "sportCoverage"
    | "stageResult"
    | "eStatus"
    | "officialMandatoryCompletionRemainsPct"
    | "closeContractVersion"
  > &
    Partial<Pick<DailyStageEResultGradeCloseV1, "closeContractVersion">>,
): DailyStageEResultGradeCloseV1 {
  const games = doc.games;
  const count = (pred: (g: DailyStageEGameRowV1) => boolean) =>
    games.filter(pred).length;
  const sportRows = (sport: string) => games.filter((g) => g.sport === sport);
  const finalResultCount = count((g) => g.resultState === "FINAL");
  const operationallyClosedCount = count((g) => g.closeClass !== "ACTIVE_RESULT_PENDING");
  const activePendingCount = count((g) => g.closeClass === "ACTIVE_RESULT_PENDING");
  const identityCoverageGapCount = count(
    (g) => g.coverageGapClass === "RESULT_IDENTITY_UNRESOLVED_TERMINAL",
  );
  const unsupportedCoverageGapCount = count(
    (g) => g.coverageGapClass === "RESULT_PROVIDER_UNSUPPORTED_TERMINAL",
  );
  const terminalCoverageGapCount = identityCoverageGapCount + unsupportedCoverageGapCount;
  const fullFinal = finalResultCount === 26;
  return {
    ...doc,
    closeContractVersion: DAILY_STAGE_E_CLOSE_CONTRACT_V2,
    lockedScope: 26,
    scopeTotal: 26,
    accountedFor: games.length,
    predictionCount: 0,
    passCount: 26,
    gradedPredictionCount: 0,
    gradedPredictions: 0,
    finalResultCount,
    pendingResultCount: count(pendingLike),
    unsupportedResultCount: count((g) => g.resultState === "UNSUPPORTED"),
    unresolvedResultCount: count(
      (g) =>
        g.resultState === "IDENTITY_UNRESOLVED" ||
        g.resultIdentityState === "IDENTITY_UNRESOLVED",
    ),
    postponedCancelledAbandonedCount: count(
      (g) =>
        g.resultState === "POSTPONED" ||
        g.resultState === "CANCELLED" ||
        g.resultState === "ABANDONED",
    ),
    liveResultCount: count((g) => g.resultState === "LIVE"),
    scheduledResultCount: count((g) => g.resultState === "SCHEDULED"),
    operationallyClosedCount,
    activePendingCount,
    terminalCoverageGapCount,
    identityCoverageGapCount,
    unsupportedCoverageGapCount,
    resultCoverage: {
      finalOfScope: `${finalResultCount}_OF_26`,
      operationallyClosedOfScope: `${operationallyClosedCount}_OF_26`,
      fullFinalClaim: fullFinal,
      note: fullFinal
        ? "FULL_FINAL_COVERAGE"
        : "OPERATIONAL_CLOSE_IS_NOT_FULL_FINAL_COVERAGE",
    },
    credit: 0,
    sportCoverage: {
      KBO: {
        counted: sportRows("KBO").length,
        final: sportRows("KBO").filter((g) => g.resultState === "FINAL").length,
        pending: sportRows("KBO").filter(pendingLike).length,
      },
      NPB: {
        counted: sportRows("NPB").length,
        final: sportRows("NPB").filter((g) => g.resultState === "FINAL").length,
        pending: sportRows("NPB").filter(pendingLike).length,
      },
      FOOTBALL: {
        counted: sportRows("FOOTBALL").length,
        final: sportRows("FOOTBALL").filter((g) => g.resultState === "FINAL").length,
        pending: sportRows("FOOTBALL").filter(pendingLike).length,
      },
      VOLLEYBALL: {
        counted: sportRows("VOLLEYBALL").length,
        unsupported: sportRows("VOLLEYBALL").filter((g) => g.resultState === "UNSUPPORTED")
          .length,
      },
    },
    stageResult: deriveDailyStageEStageResult(games),
    eStatus: deriveDailyStageEStatus(games),
    officialMandatoryCompletionRemainsPct: 60,
  };
}

function recountCloseDocument(
  doc: DailyStageEResultGradeCloseV1,
): DailyStageEResultGradeCloseV1 {
  return assembleCloseAggregates(doc);
}

export async function applyTerminalCoverageGapV2ToClose(input: {
  cwd?: string;
  existing: DailyStageEResultGradeCloseV1;
}): Promise<DailyStageEResultGradeCloseV1> {
  const cwd = input.cwd ?? process.cwd();
  const sources = await loadStageESources(cwd);
  const gapCtx = await loadStageETerminalGapContext(cwd, sources.b1ByOperatorId);
  const cByOperatorId = new Map(sources.cGames.map((g) => [g.operatorGameId, g]));
  const games = attachStageECloseV2(
    input.existing.games.map((row) => stripCloseClassification(row)),
    cByOperatorId,
    gapCtx,
  );
  return assembleCloseAggregates({
    ...input.existing,
    games,
  });
}

export async function recheckExactFootballFixtureInClose(input: {
  cwd?: string;
  fixtureId: string;
  existing: DailyStageEResultGradeCloseV1;
  resultRunAt: string;
}): Promise<{
  document: DailyStageEResultGradeCloseV1;
  liveCall: boolean;
  cached: boolean;
  providerStatusRaw: string | null;
  resultStateChanged: boolean;
  scoreChanged: boolean;
}> {
  const cwd = input.cwd ?? process.cwd();
  const sources = await loadStageESources(cwd);
  const gapCtx = await loadStageETerminalGapContext(cwd, sources.b1ByOperatorId);
  const cByOperatorId = new Map(sources.cGames.map((g) => [g.operatorGameId, g]));
  if (resolveFootballProviderKind() === "dummy") {
    throw new Error("DUMMY_PROVIDER_NOT_RESEARCH");
  }
  const football = getFootballProvider();
  let fetched: { fixture: FixtureRaw | null; cached: boolean } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fetched = await football.getFixtureById(Number(input.fixtureId));
      break;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 429 && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 20000));
        continue;
      }
      throw error;
    }
  }
  if (!fetched) {
    throw new Error(`STAGE_E_FIXTURE_RECHECK_FAILED: ${input.fixtureId}`);
  }
  const fixtures = new Map<string, FixtureRaw>();
  if (fetched.fixture) fixtures.set(input.fixtureId, fetched.fixture);
  const previous = input.existing.games.find((g) => g.providerFixtureId === input.fixtureId);
  const observations = input.existing.games.map((row) => {
    if (row.providerFixtureId !== input.fixtureId) {
      return stripCloseClassification(row);
    }
    const cGame = sources.cGames.find((g) => g.operatorGameId === row.operatorGameId);
    if (!cGame) return stripCloseClassification(row);
    const b1 = sources.b1ByOperatorId.get(row.operatorGameId);
    return footballRow(cGame, b1, fixtures, input.resultRunAt);
  });
  const games = attachStageECloseV2(observations, cByOperatorId, gapCtx);
  const call: DailyStageEProviderCall = {
    provider: "API_FOOTBALL",
    endpoint: "/fixtures",
    purpose: "Football official result recheck by exact providerFixtureId",
    sport: "FOOTBALL",
    fixtureId: input.fixtureId,
    cacheMissReason: fetched.cached ? "IN_MEMORY_CACHE_HIT" : "RESULT_RECHECK_CACHE_MISS",
    liveCall: !fetched.cached,
  };
  const document = recountCloseDocument({
    ...input.existing,
    games,
    providerCalls: [...input.existing.providerCalls, call],
    providerLiveCallCount:
      input.existing.providerLiveCallCount + (fetched.cached ? 0 : 1),
  });
  const updated = document.games.find((g) => g.providerFixtureId === input.fixtureId);
  return {
    document,
    liveCall: !fetched.cached,
    cached: fetched.cached,
    providerStatusRaw: updated?.providerStatusRaw ?? fetched.fixture?.fixture?.status?.short ?? null,
    resultStateChanged: previous?.resultState !== updated?.resultState,
    scoreChanged:
      previous?.homeScore !== updated?.homeScore || previous?.awayScore !== updated?.awayScore,
  };
}

export async function buildDailyStageEResultGradeV1(
  input: StageECollectInput,
): Promise<DailyStageEResultGradeCloseV1> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst ?? STAGE_E_DATE_KST;
  const sources = await loadStageESources(cwd);
  const gapCtx = await loadStageETerminalGapContext(cwd, sources.b1ByOperatorId);
  const cByOperatorId = new Map(sources.cGames.map((g) => [g.operatorGameId, g]));
  const calls: DailyStageEProviderCall[] = [];
  let kboGames = input.baseballGames?.kbo ?? [];
  let npbGames = input.baseballGames?.npb ?? [];
  const footballFixtures = input.footballFixtures ?? new Map<string, FixtureRaw>();

  if (input.fetchLive) {
    const kboIds = [
      ...new Set(
        sources.cGames
          .filter((g) => g.sport === "KBO")
          .map((g) => sources.b1ByOperatorId.get(g.operatorGameId)?.providerFixtureId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const npbIds = [
      ...new Set(
        sources.cGames
          .filter((g) => g.sport === "NPB")
          .map((g) => sources.b1ByOperatorId.get(g.operatorGameId)?.providerFixtureId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const kboFetch = await fetchApiBaseballGamesByIds({
      cwd,
      ids: kboIds,
      sport: "KBO",
    });
    kboGames = kboFetch.games;
    calls.push(...kboFetch.calls);
    if (!kboFetch.blocked) {
      const npbFetch = await fetchApiBaseballGamesByIds({
        cwd,
        ids: npbIds,
        sport: "NPB",
      });
      npbGames = npbFetch.games;
      calls.push(...npbFetch.calls);
    } else {
      calls.push({
        provider: "API_BASEBALL",
        endpoint: "/games",
        purpose: "NPB official result skipped after season-access block",
        sport: "NPB",
        fixtureId: null,
        cacheMissReason: "PROVIDER_SEASON_NOT_ACCESSIBLE",
        liveCall: false,
      });
    }

    if (resolveFootballProviderKind() === "dummy") {
      throw new Error("DUMMY_PROVIDER_NOT_RESEARCH");
    }
    const football = getFootballProvider();
    const footballIds = [
      ...new Set(
        sources.cGames
          .filter((g) => g.sport === "FOOTBALL")
          .map((g) => sources.b1ByOperatorId.get(g.operatorGameId)?.providerFixtureId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    for (const id of footballIds) {
      let fetched: { fixture: FixtureRaw | null; cached: boolean } | null = null;
      let rateLimited = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          fetched = await football.getFixtureById(Number(id));
          break;
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (status === 429 && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 20000));
            continue;
          }
          if (status === 429) {
            rateLimited = true;
            break;
          }
          throw error;
        }
      }
      if (rateLimited) {
        calls.push({
          provider: "API_FOOTBALL",
          endpoint: "/fixtures",
          purpose: "Football official result by exact providerFixtureId",
          sport: "FOOTBALL",
          fixtureId: id,
          cacheMissReason: "PROVIDER_RATE_LIMITED",
          liveCall: true,
        });
        continue;
      }
      if (!fetched) continue;
      if (fetched.fixture) footballFixtures.set(id, fetched.fixture);
      calls.push({
        provider: "API_FOOTBALL",
        endpoint: "/fixtures",
        purpose: "Football official result by exact providerFixtureId",
        sport: "FOOTBALL",
        fixtureId: id,
        cacheMissReason: fetched.cached ? "IN_MEMORY_CACHE_HIT" : "RESULT_COLLECTION_CACHE_MISS",
        liveCall: !fetched.cached,
      });
    }
  }

  const observations = sources.cGames.map((game) => {
    const b1 = sources.b1ByOperatorId.get(game.operatorGameId);
    if (game.sport === "VOLLEYBALL") {
      return notGradableRow(game, {
        resultIdentityState: "PROVIDER_NOT_SUPPORTED",
        providerFixtureId: null,
        resultState: "UNSUPPORTED",
        homeScore: null,
        awayScore: null,
        resultProvider: null,
        resultObservedAt: null,
        providerStatusRaw: null,
      });
    }
    if (game.sport === "KBO") {
      return baseballRow(game, b1, kboGames, input.resultRunAt);
    }
    if (game.sport === "NPB") {
      return baseballRow(game, b1, npbGames, input.resultRunAt);
    }
    if (game.sport === "FOOTBALL") {
      return footballRow(game, b1, footballFixtures, input.resultRunAt);
    }
    return notGradableRow(game, {
      resultIdentityState: "PROVIDER_NOT_SUPPORTED",
      providerFixtureId: null,
      resultState: "UNSUPPORTED",
      homeScore: null,
      awayScore: null,
      resultProvider: null,
      resultObservedAt: null,
      providerStatusRaw: null,
    });
  });

  const games = attachStageECloseV2(observations, cByOperatorId, gapCtx);

  if (games.length !== 26) {
    throw new Error(`STAGE_E_ACCOUNTING_GAP: ${games.length}`);
  }

  return assembleCloseAggregates({
    schemaVersion: DAILY_STAGE_E_RESULT_GRADE_SCHEMA,
    dateKst,
    mandatoryStage: "E_RESULT_AND_GRADE",
    weight: 15,
    resultRunAt: input.resultRunAt,
    sourceCArtifact: STAGE_E_C_RECONCILIATION_REL,
    sourceCHash: sources.cHash,
    sourceSnapshotArtifact: STAGE_E_SNAPSHOT_REL,
    sourceSnapshotHash: sources.snapshotHash,
    sourceB1Artifact: STAGE_E_B1_REL,
    gradeStatus: DAILY_STAGE_E_GRADE_STATUS,
    gradeReason: DAILY_STAGE_E_GRADE_REASON,
    passConvertedToPredictionCount: 0,
    passHitMissCount: 0,
    passWinLossCount: 0,
    correct: 0,
    incorrect: 0,
    retroactivePredictionAllowed: false,
    retroactiveGradeFabricationAllowed: false,
    resultRequiresCanonical: false,
    fuzzyResultMatching: false,
    engineConnected: false,
    predictionConnected: false,
    marketOddsUsedForGrade: false,
    providerPredictionsEndpointUsed: false,
    playerContextP1EndpointsUsed: false,
    providerCalls: calls,
    providerLiveCallCount: calls.filter((c) => c.liveCall).length,
    games,
    leakage: {
      pregameArtifactsWritten: false,
      predictionArtifactsWritten: false,
      engineConnected: false,
      cArtifactMutated: false,
    },
  });
}

export function assertDailyStageEInvariants(doc: DailyStageEResultGradeCloseV1): void {
  if (doc.lockedScope !== 26 || doc.accountedFor !== 26 || doc.games.length !== 26) {
    throw new Error("STAGE_E_DENOMINATOR_INVALID");
  }
  if (doc.predictionCount !== 0 || doc.passCount !== 26) {
    throw new Error("STAGE_E_C_IMMUTABLE_MISMATCH");
  }
  if (doc.gradedPredictionCount !== 0 || doc.passHitMissCount !== 0 || doc.passWinLossCount !== 0) {
    throw new Error("STAGE_E_PASS_GRADED_AS_PREDICTION");
  }
  if (doc.games.some((g) => g.predictionHit !== null)) {
    throw new Error("STAGE_E_PREDICTION_HIT_BOOLEAN_FORBIDDEN");
  }
  if (doc.games.some((g) => g.gradeState !== "NOT_GRADABLE")) {
    throw new Error("STAGE_E_GRADE_NOT_NOT_GRADABLE");
  }
  if (doc.games.some((g) => g.predictionCreated !== false)) {
    throw new Error("STAGE_E_PREDICTION_CREATED");
  }
  if (
    doc.games.some(
      (g) =>
        g.resultState !== "FINAL" &&
        (g.homeScore != null || g.awayScore != null),
    )
  ) {
    throw new Error("STAGE_E_NON_FINAL_SCORE_FORBIDDEN");
  }
  if (doc.resultRequiresCanonical !== false) {
    throw new Error("STAGE_E_RESULT_REQUIRES_CANONICAL");
  }
  if (doc.fuzzyResultMatching !== false) {
    throw new Error("STAGE_E_FUZZY_MATCHING");
  }
  if (doc.engineConnected || doc.predictionConnected || doc.marketOddsUsedForGrade) {
    throw new Error("STAGE_E_ENGINE_OR_MARKET_LEAK");
  }
  if (doc.providerPredictionsEndpointUsed || doc.playerContextP1EndpointsUsed) {
    throw new Error("STAGE_E_FORBIDDEN_ENDPOINT");
  }
  if (doc.scopeTotal !== 26 || doc.credit !== 0) {
    throw new Error("STAGE_E_V2_SCOPE_OR_CREDIT");
  }
  if (doc.operationallyClosedCount + doc.activePendingCount !== 26) {
    throw new Error("STAGE_E_V2_CLOSE_PENDING_SPLIT");
  }
  if (
    doc.terminalCoverageGapCount !==
    doc.identityCoverageGapCount + doc.unsupportedCoverageGapCount
  ) {
    throw new Error("STAGE_E_V2_GAP_SPLIT");
  }
  if (doc.resultCoverage.fullFinalClaim && doc.finalResultCount !== 26) {
    throw new Error("STAGE_E_V2_FALSE_FULL_FINAL_CLAIM");
  }
  if (doc.finalResultCount !== 26 && doc.resultCoverage.finalOfScope === "26_OF_26") {
    throw new Error("STAGE_E_V2_FALSE_26_OF_26_FINAL");
  }
  if (doc.games.some((g) => g.resultState === "LIVE" && g.coverageGapClass != null)) {
    throw new Error("STAGE_E_LIVE_MARKED_TERMINAL_GAP");
  }
  if (
    doc.games.some(
      (g) =>
        g.exactResultLookupAvailable &&
        (g.resultState === "LIVE" || g.resultState === "SCHEDULED") &&
        g.closeClass !== "ACTIVE_RESULT_PENDING",
    )
  ) {
    throw new Error("STAGE_E_EXACT_LOOKUP_NOT_ACTIVE");
  }
  if (doc.games.some((g) => g.fuzzyMatchingUsed !== false)) {
    throw new Error("STAGE_E_FUZZY_ON_ROW");
  }
  if (doc.activePendingCount > 0 && doc.eStatus !== "PARTIAL") {
    throw new Error("STAGE_E_LIVE_OR_PENDING_MARKED_COMPLETE");
  }
  if (
    doc.eStatus === "CANDIDATE_COMPLETE" &&
    (doc.activePendingCount !== 0 || doc.operationallyClosedCount !== 26)
  ) {
    throw new Error("STAGE_E_V2_COMPLETE_WITHOUT_OPERATIONAL_CLOSE");
  }
}
