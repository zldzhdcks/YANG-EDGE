/**
 * 2026-08-26 B2 / B2.1 pregame input + paid-provider odds coverage.
 *
 * ROOT CAUSE (B2 quota defect):
 * `runPregameInputOddsCoverage` mixed COLLECT and CLASSIFY/BUILD in one
 * function. Rebuilding the coverage audit therefore called
 * TheOddsApiProvider.resolveBaseballLeagueKeys + getOdds(kbo) + getOdds(npb)
 * again. The in-process odds cache does not survive a new process, so the
 * second run spent 2 extra live h2h units (actual original B2 live calls = 4).
 *
 * REQUIRED ARCHITECTURE:
 *   LIVE PROVIDER
 *     → IMMUTABLE POINT-IN-TIME ODDS OBSERVATION  (already captured)
 *     → NORMALIZE / JOIN
 *     → B2 COVERAGE AUDIT
 *     → TEST / REBUILD
 *
 * Only the first step may access The Odds API. This script's default path is
 * REPLAY from stored evidence and performs ZERO provider network calls.
 *
 * Observation roles:
 *   B2_ODDS_OBS_INDEX_REL
 *     stable index / first intended collection (2026-08-26T03:42:29.127Z)
 *   B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL
 *     append-only timestamped capture of the unintended rebuild
 *     (2026-08-26T03:43:18.739Z). Preserved. Never used to refresh odds.
 *
 *   npx tsx scripts/audit-2026-08-26-pregame-input-odds-coverage-v1.ts
 *   npx tsx scripts/audit-2026-08-26-pregame-input-odds-coverage-v1.ts --collect-odds
 *     → rejected: observation already captured
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { instantToKst } from "../src/lib/datetime/kst";
import { resolveKboTeamIdentity } from "../src/lib/kbo/resolve-kbo-team-identity";
import { resolveNpbTeamIdentity } from "../src/lib/npb/resolve-npb-team-identity";
import { TEAM_ALIASES } from "../src/lib/teams/team-aliases";
import { normalizeTeamName } from "../src/lib/teams/normalize-team-name";
import type { OddsUsageMeta } from "../src/lib/odds/types";
import { FIXTURES_CAPTURE_REL } from "./capture-2026-08-26-football-fixtures-v1";
import {
  DATE_KST,
  FROZEN_OBS_HASH,
  LOCK_REL,
  SOURCE_OBS_REL,
  TOTAL_OBSERVED,
  sha256File,
} from "./lock-2026-08-26-daily-scope-v1";
import { RECONCILIATION_REL } from "./audit-2026-08-26-schedule-identity-reconciliation-v1";

export const B2_COVERAGE_REL =
  "data/audits/2026-08-26-pregame-input-odds-coverage-v1.json";
export const B2_GAP_REL = "data/audits/2026-08-26-provider-coverage-gap-v1.json";
/** Stable index: first intended The Odds API collection. Replay source. */
export const B2_ODDS_OBS_INDEX_REL =
  "data/research/odds/2026-08-26-the-odds-api-h2h-observation-v1.json";
export const B2_ODDS_OBS_REL = B2_ODDS_OBS_INDEX_REL;
/** Append-only timestamped capture of the unintended classification rebuild. */
export const B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL =
  "data/research/odds/2026-08-26-the-odds-api-h2h-observation-2026-08-26T03-43-18-739Z-v1.json";
export const KBO_STANDINGS_REL =
  "data/research/kbo/2026-08-26-api-baseball-standings-raw-v1.json";
export const NPB_STANDINGS_REL =
  "data/research/npb/2026-08-26-api-baseball-standings-raw-v1.json";
export const KBO_FORM_REL =
  "data/research/kbo/2026-08-26-api-baseball-recent-form-asof-v1.json";
export const MANUAL_OBS_KIND = "MANUAL_OPERATOR_MARKET_OBSERVATION";
export const PROVIDER_OBS_KIND = "PROVIDER_MARKET_OBSERVATION";

export const SEALED_B1_SHA = "e12edabe4b8c46eeab4653ff6426f799075b64fe";
export const SEALED_LOCK_HASH =
  "97d04ce464c6e062264f20ea3de323a3e60eeac2e410c9ed6cf59c77d8a6c501";
export const SEALED_RECON_HASH =
  "405c7f659edc21c9330d65c1bb61289776f8fd4e369b24a07101032105dd20b5";
export const SEALED_ODDS_INDEX_HASH =
  "9ab79ebba53a9cfa45aba05f66b089709044c408d2b7d24db7018547e6904322";
export const SEALED_ODDS_IMMUTABLE_CAPTURE_HASH =
  "fadd7d0690318514e08a2cc2d2d33be55d8b8cd3c1d314412721348d6a1a72b1";
export const ORIGINAL_B2_CLASSIFIED_AT = "2026-08-26T03:43:18.739Z";
export const ORIGINAL_ODDS_INDEX_OBSERVED_AT = "2026-08-26T03:42:29.127Z";

export const ORIGINAL_B2_ODDS_LIVE_CALLS = {
  actualLiveCallsDuringOriginalB2: 4,
  intendedCollectionCalls: 2,
  unintendedRebuildCalls: 2,
  futureExpectedCallsForEquivalentCollection: 2,
} as const;

type CoverageCode =
  | "AVAILABLE_COLLECTED"
  | "AVAILABLE_CACHED"
  | "NOT_AVAILABLE_FROM_PROVIDER"
  | "ADAPTER_NOT_IMPLEMENTED"
  | "NOT_COLLECTED_REASON"
  | "MISSED_PRE_GAME_WINDOW"
  | "IDENTITY_BLOCKED"
  | "PROVIDER_NOT_SUPPORTED";

type TemporalState =
  | "PRE_GAME_OPEN"
  | "MISSED_PRE_GAME_WINDOW"
  | "IDENTITY_BLOCKED"
  | "PROVIDER_NOT_SUPPORTED";

type OddsJoinStatus =
  | "ODDS_COLLECTED"
  | "ODDS_PROVIDER_NO_EVENT"
  | "ODDS_IDENTITY_BLOCKED"
  | "ODDS_NOT_SUPPORTED"
  | "MISSED_PRE_GAME_WINDOW";

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
  providerFixtureId?: string | null;
  providerHomeTeamId?: string | null;
  providerAwayTeamId?: string | null;
  reasons?: string[];
};

type B1Doc = {
  lockedScope: number;
  accountedFor: number;
  statusCounts: Record<string, number>;
  missedPreGameWindowCount: number;
  sourceDailyScopeLockHash: string;
  sourceOperatorObservationHash: string;
  games: B1Game[];
  leakage: Record<string, unknown>;
};

type StoredOddsEvent = {
  externalEventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bestHomeOdds: number | null;
  bestAwayOdds: number | null;
  impliedHomeProbability: number | null;
  impliedAwayProbability: number | null;
};

type OddsCallRecord = {
  sportKey: string | null;
  requestedMarket: string;
  requestedRegion: string;
  requestTime: string;
  responseTime: string;
  cached: boolean;
  usage: OddsUsageMeta;
  eventsReturned: number;
};

type StoredOddsObservation = {
  schemaVersion: string;
  observationId: string;
  observedAt: string;
  appendOnly?: boolean;
  overwriteForbidden?: boolean;
  marketBenchmarkOnly: boolean;
  predictionInput: boolean;
  engineInput: boolean;
  kind?: string;
  commenceTimeFrom: string;
  commenceTimeTo: string;
  requestedMarkets: string;
  requestedRegions: string;
  sportKeys: { kbo: string | null; npb: string | null };
  calls: OddsCallRecord[];
  kboEvents: StoredOddsEvent[];
  npbEvents: StoredOddsEvent[];
};

export type PregameCoverageRunMode = "replay" | "collect";

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function assertNoSecrets(value: unknown, trail: string): void {
  const text = JSON.stringify(value);
  if (/apiKey=/i.test(text) || /x-apisports-key/i.test(text)) {
    throw new Error(`SECRET_LEAKAGE:${trail}`);
  }
}

function classifyTemporal(
  game: B1Game,
  nowMs: number,
): { temporalState: TemporalState; missedPreGameWindow: boolean } {
  if (game.sport === "VOLLEYBALL") {
    return {
      temporalState: "PROVIDER_NOT_SUPPORTED",
      missedPreGameWindow: true,
    };
  }
  const kickoff = game.displayedKickoffUtc
    ? Date.parse(game.displayedKickoffUtc)
    : NaN;
  const missed =
    game.missedPreGameWindow === true ||
    (Number.isFinite(kickoff) && nowMs >= kickoff);
  if (missed) {
    return {
      temporalState: "MISSED_PRE_GAME_WINDOW",
      missedPreGameWindow: true,
    };
  }
  if (game.status !== "MATCHED") {
    return { temporalState: "IDENTITY_BLOCKED", missedPreGameWindow: false };
  }
  return { temporalState: "PRE_GAME_OPEN", missedPreGameWindow: false };
}

function baseballIdentity(
  sport: string,
  name: string,
): { canonicalTeamId: string | null; mappingStatus: "MATCHED" | "UNMATCHED" } {
  const n = normalizeTeamName(name);
  const league = sport === "KBO" ? "KBO" : "NPB";
  const alias = TEAM_ALIASES.find((a) => {
    if (a.league !== league || a.sport !== "baseball") return false;
    if (normalizeTeamName(a.displayName) === n) return true;
    return a.originalNames.some((orig) => normalizeTeamName(orig) === n);
  });
  if (!alias) {
    return { canonicalTeamId: null, mappingStatus: "UNMATCHED" };
  }
  const hit =
    sport === "KBO"
      ? resolveKboTeamIdentity(alias.originalNames[0] ?? alias.displayName)
      : resolveNpbTeamIdentity(alias.originalNames[0] ?? alias.displayName);
  return {
    canonicalTeamId: hit.canonicalTeamId,
    mappingStatus: hit.mappingStatus,
  };
}

function sameKstDate(iso: string | null | undefined, dateKst: string): boolean {
  if (!iso) return false;
  const k = instantToKst(iso);
  return Boolean(k && k.date === dateKst);
}

function joinExactOddsEvent(
  game: B1Game,
  events: StoredOddsEvent[],
): { status: OddsJoinStatus; event: StoredOddsEvent | null; candidates: number } {
  if (game.sport !== "KBO" && game.sport !== "NPB") {
    return { status: "ODDS_NOT_SUPPORTED", event: null, candidates: 0 };
  }
  if (game.status !== "MATCHED" || !game.canonicalHome || !game.canonicalAway) {
    return { status: "ODDS_IDENTITY_BLOCKED", event: null, candidates: 0 };
  }
  const home = baseballIdentity(game.sport, game.canonicalHome);
  const away = baseballIdentity(game.sport, game.canonicalAway);
  if (home.mappingStatus !== "MATCHED" || away.mappingStatus !== "MATCHED") {
    return { status: "ODDS_IDENTITY_BLOCKED", event: null, candidates: 0 };
  }
  const hits = events.filter((ev) => {
    if (!sameKstDate(ev.commenceTime, DATE_KST)) return false;
    const eh = baseballIdentity(game.sport, ev.homeTeam);
    const ea = baseballIdentity(game.sport, ev.awayTeam);
    return (
      eh.mappingStatus === "MATCHED" &&
      ea.mappingStatus === "MATCHED" &&
      eh.canonicalTeamId === home.canonicalTeamId &&
      ea.canonicalTeamId === away.canonicalTeamId
    );
  });
  if (hits.length === 1) {
    return { status: "ODDS_COLLECTED", event: hits[0]!, candidates: 1 };
  }
  if (hits.length > 1) {
    return { status: "ODDS_IDENTITY_BLOCKED", event: null, candidates: hits.length };
  }
  return { status: "ODDS_PROVIDER_NO_EVENT", event: null, candidates: 0 };
}

function coverageCell(
  status: CoverageCode,
  note: string,
): { status: CoverageCode; note: string } {
  return { status, note };
}

function readJson<T>(rel: string, cwd: string): T {
  return JSON.parse(readFileSync(path.join(cwd, rel), "utf8")) as T;
}

function loadSealedOddsObservation(
  rel: string,
  expectedHash: string,
  cwd: string,
): StoredOddsObservation {
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) {
    throw new Error(`ODDS_OBSERVATION_MISSING:${rel}`);
  }
  const hash = sha256File(abs);
  if (hash !== expectedHash) {
    throw new Error(`ODDS_OBSERVATION_MUTATED:${rel}`);
  }
  const doc = readJson<StoredOddsObservation>(rel, cwd);
  assertNoSecrets(doc, rel);
  if (doc.marketBenchmarkOnly !== true) {
    throw new Error(`ODDS_NOT_BENCHMARK:${rel}`);
  }
  if (doc.predictionInput !== false || doc.engineInput !== false) {
    throw new Error(`ODDS_MARKED_AS_MODEL_INPUT:${rel}`);
  }
  return doc;
}

async function writeJson(rel: string, document: unknown, cwd: string) {
  assertNoSecrets(document, rel);
  const abs = path.join(cwd, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  const body = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(abs, body, "utf8");
  return { rel, sha256: sha256Text(body) };
}

/**
 * Live The Odds API collection is a separate step and is complete for 2026-08-26.
 * Calling this after the immutable observation exists MUST NOT hit the network.
 */
export async function collectLiveTheOddsApiObservation(
  cwd = process.cwd(),
): Promise<never> {
  const indexAbs = path.join(cwd, B2_ODDS_OBS_INDEX_REL);
  if (existsSync(indexAbs)) {
    throw new Error(
      "ODDS_OBSERVATION_ALREADY_CAPTURED: replay the stored observation; live The Odds API is forbidden",
    );
  }
  throw new Error(
    "B2_1_LIVE_ODDS_FORBIDDEN: this mission must not collect a new The Odds API observation",
  );
}

export async function runPregameInputOddsCoverage(
  cwd = process.cwd(),
  options: { mode?: PregameCoverageRunMode } = {},
) {
  const mode: PregameCoverageRunMode = options.mode ?? "replay";
  if (mode === "collect") {
    await collectLiveTheOddsApiObservation(cwd);
  }

  const replayedAt = new Date().toISOString();
  const classifiedAt = ORIGINAL_B2_CLASSIFIED_AT;
  const classifiedAtMs = Date.parse(classifiedAt);
  const lockAbs = path.join(cwd, LOCK_REL);
  const reconAbs = path.join(cwd, RECONCILIATION_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  if (!existsSync(lockAbs) || !existsSync(reconAbs) || !existsSync(obsAbs)) {
    throw new Error("B1_OR_LOCK_MISSING");
  }
  if (sha256File(lockAbs) !== SEALED_LOCK_HASH) {
    throw new Error("SEALED_SCOPE_LOCK_CHANGED");
  }
  if (sha256File(reconAbs) !== SEALED_RECON_HASH) {
    throw new Error("B1_RECONCILIATION_CHANGED");
  }
  if (sha256File(obsAbs) !== FROZEN_OBS_HASH) {
    throw new Error("SOURCE_OBSERVATION_CHANGED");
  }

  const recon = JSON.parse(readFileSync(reconAbs, "utf8")) as B1Doc;
  if (recon.lockedScope !== TOTAL_OBSERVED || recon.games.length !== TOTAL_OBSERVED) {
    throw new Error("DENOMINATOR_CHANGED");
  }

  const oddsIndex = loadSealedOddsObservation(
    B2_ODDS_OBS_INDEX_REL,
    SEALED_ODDS_INDEX_HASH,
    cwd,
  );
  const oddsCapture = loadSealedOddsObservation(
    B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL,
    SEALED_ODDS_IMMUTABLE_CAPTURE_HASH,
    cwd,
  );
  if (oddsIndex.observedAt !== ORIGINAL_ODDS_INDEX_OBSERVED_AT) {
    throw new Error("ODDS_INDEX_TIMESTAMP_CHANGED");
  }
  if (oddsIndex.kboEvents.length !== 5 || oddsIndex.npbEvents.length !== 6) {
    throw new Error("ODDS_INDEX_EVENT_COUNT_CHANGED");
  }

  const historicalCalls = [...oddsIndex.calls, ...oddsCapture.calls];
  const actualLive = historicalCalls.filter((c) => c.sportKey && !c.cached).length;
  if (actualLive !== ORIGINAL_B2_ODDS_LIVE_CALLS.actualLiveCallsDuringOriginalB2) {
    throw new Error("HISTORICAL_ODDS_LIVE_CALL_COUNT_CHANGED");
  }

  const kboStandingsExists = existsSync(path.join(cwd, KBO_STANDINGS_REL));
  const npbStandingsExists = existsSync(path.join(cwd, NPB_STANDINGS_REL));
  const kboFormExists = existsSync(path.join(cwd, KBO_FORM_REL));

  const rows = recon.games.map((game) => {
    const temporal = classifyTemporal(game, classifiedAtMs);
    const classifiedAsPreGame = temporal.temporalState === "PRE_GAME_OPEN";
    if (temporal.missedPreGameWindow && classifiedAsPreGame) {
      throw new Error(`FAKE_PRE_GAME:${game.operatorGameId}`);
    }

    const coverage = {
      schedule: coverageCell(
        game.sport === "VOLLEYBALL"
          ? "PROVIDER_NOT_SUPPORTED"
          : game.status === "MATCHED" || game.sport === "FOOTBALL"
            ? "AVAILABLE_CACHED"
            : "IDENTITY_BLOCKED",
        game.sport === "FOOTBALL"
          ? "Reused captured API-Football dump / schedule artifact. Not attached unless B1 MATCHED."
          : game.status === "MATCHED"
            ? "B1 schedule artifact reused. No extra schedule fetch."
            : "No lawful schedule provider.",
      ),
      identity: coverageCell(
        game.status === "MATCHED"
          ? "AVAILABLE_CACHED"
          : game.sport === "VOLLEYBALL"
            ? "PROVIDER_NOT_SUPPORTED"
            : "IDENTITY_BLOCKED",
        `B1 status=${game.status}`,
      ),
      starter: coverageCell(
        game.sport === "KBO" || game.sport === "NPB"
          ? "NOT_AVAILABLE_FROM_PROVIDER"
          : game.sport === "FOOTBALL"
            ? "ADAPTER_NOT_IMPLEMENTED"
            : "PROVIDER_NOT_SUPPORTED",
        game.sport === "KBO" || game.sport === "NPB"
          ? "API-BASEBALL has no players/lineups/injuries endpoints (coverage probe)."
          : game.sport === "FOOTBALL"
            ? "FootballProvider.getLineups exists raw-only; not collected because operator identity is unresolved."
            : "No volleyball provider.",
      ),
      teamSeasonStats: coverageCell(
        game.sport === "KBO" || game.sport === "NPB"
          ? "ADAPTER_NOT_IMPLEMENTED"
          : game.sport === "FOOTBALL"
            ? "ADAPTER_NOT_IMPLEMENTED"
            : "PROVIDER_NOT_SUPPORTED",
        "Endpoint exists on the client/probe. No YANG adapter. Per-team calls skipped for quota.",
      ),
      recentForm: coverageCell("NOT_COLLECTED_REASON", ""),
      standings: coverageCell("NOT_COLLECTED_REASON", ""),
      rosterOrInjury: coverageCell(
        game.sport === "KBO" || game.sport === "NPB"
          ? "NOT_AVAILABLE_FROM_PROVIDER"
          : game.sport === "FOOTBALL"
            ? "ADAPTER_NOT_IMPLEMENTED"
            : "PROVIDER_NOT_SUPPORTED",
        game.sport === "FOOTBALL"
          ? "getInjuries is raw-only. Not called: cannot attach to operator games."
          : "API-BASEBALL does not expose injuries/roster.",
      ),
      otherAvailablePregame: coverageCell(
        "NOT_COLLECTED_REASON",
        "No additional implemented adapters for weather/venue depth.",
      ),
    };

    if (temporal.missedPreGameWindow && game.sport !== "VOLLEYBALL") {
      coverage.recentForm = coverageCell(
        "MISSED_PRE_GAME_WINDOW",
        "Kickoff already passed. Fresh pregame stats not labeled PRE_GAME.",
      );
      coverage.standings = coverageCell(
        "MISSED_PRE_GAME_WINDOW",
        "Kickoff already passed.",
      );
    } else if (game.sport === "KBO") {
      coverage.recentForm = coverageCell(
        kboFormExists ? "AVAILABLE_CACHED" : "NOT_COLLECTED_REASON",
        "Derived from cached API-BASEBALL season games. Target and later games excluded. Cache hit.",
      );
      coverage.standings = coverageCell(
        kboStandingsExists ? "AVAILABLE_CACHED" : "NOT_COLLECTED_REASON",
        "Raw league standings stored. YANG standings adapter not implemented.",
      );
    } else if (game.sport === "NPB") {
      coverage.recentForm = coverageCell(
        "NOT_COLLECTED_REASON",
        "NPB B1 schedule is date-filtered. No cached season dump; extra season fetch skipped.",
      );
      coverage.standings = coverageCell(
        npbStandingsExists ? "AVAILABLE_CACHED" : "NOT_COLLECTED_REASON",
        "Raw league standings stored. YANG standings adapter not implemented.",
      );
    } else if (game.sport === "FOOTBALL") {
      coverage.recentForm = coverageCell(
        "IDENTITY_BLOCKED",
        "Football operator identity unresolved. Provider form not attached.",
      );
      coverage.standings = coverageCell(
        "IDENTITY_BLOCKED",
        "getStandings exists raw-only. Not called: cannot attach to operator games.",
      );
      coverage.schedule = coverageCell(
        "AVAILABLE_CACHED",
        `Reused ${FIXTURES_CAPTURE_REL}. operatorGameAttached=false`,
      );
    }

    let oddsStatus: OddsJoinStatus = "ODDS_NOT_SUPPORTED";
    let oddsEvent: StoredOddsEvent | null = null;
    let oddsCandidates = 0;
    if (game.sport === "VOLLEYBALL") {
      oddsStatus = "ODDS_NOT_SUPPORTED";
    } else if (temporal.missedPreGameWindow && game.sport !== "KBO" && game.sport !== "NPB") {
      oddsStatus = "MISSED_PRE_GAME_WINDOW";
    } else if (game.sport === "FOOTBALL") {
      oddsStatus = "ODDS_IDENTITY_BLOCKED";
    } else {
      const joined = joinExactOddsEvent(
        game,
        game.sport === "KBO" ? oddsIndex.kboEvents : oddsIndex.npbEvents,
      );
      oddsStatus = joined.status;
      oddsEvent = joined.event;
      oddsCandidates = joined.candidates;
    }

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
      temporalState: temporal.temporalState,
      missedPreGameWindow: temporal.missedPreGameWindow,
      classifiedAsPreGame,
      b1IdentityState: game.status,
      scheduleState: coverage.schedule.status,
      pregameDataCoverage: coverage,
      oddsState: oddsStatus,
      oddsCandidates,
      oddsProviderEventId: oddsEvent?.externalEventId ?? null,
      oddsHomeTeam: oddsEvent?.homeTeam ?? null,
      oddsAwayTeam: oddsEvent?.awayTeam ?? null,
      oddsBestHome: oddsEvent?.bestHomeOdds ?? null,
      oddsBestAway: oddsEvent?.bestAwayOdds ?? null,
      impliedHomeProbability: oddsEvent?.impliedHomeProbability ?? null,
      impliedAwayProbability: oddsEvent?.impliedAwayProbability ?? null,
      providers: [
        game.sport === "KBO" || game.sport === "NPB" ? "API_BASEBALL" : null,
        game.sport === "KBO" || game.sport === "NPB" ? "THE_ODDS_API" : null,
        game.sport === "FOOTBALL" ? "API_FOOTBALL" : null,
      ].filter(Boolean),
      marketBenchmarkOnly: true,
      predictionInput: false,
      engineInput: false,
      operatorGameAttached:
        game.status === "MATCHED" &&
        (oddsStatus === "ODDS_COLLECTED" || game.sport === "KBO" || game.sport === "NPB"),
      manualOperatorMarketObservation: {
        kind: MANUAL_OBS_KIND,
        sourceRel: SOURCE_OBS_REL,
        predictionInput: false,
        engineInput: false,
        mergedWithProviderOdds: false,
      },
      providerMarketObservation: {
        kind: PROVIDER_OBS_KIND,
        provider: "THE_ODDS_API",
        status: oddsStatus,
        predictionInput: false,
        engineInput: false,
        marketBenchmarkOnly: true,
        sourceObservationRel: B2_ODDS_OBS_INDEX_REL,
      },
      blockingReason:
        game.status === "MATCHED" && oddsStatus === "ODDS_COLLECTED"
          ? null
          : [
              game.status !== "MATCHED" ? `B1:${game.status}` : null,
              oddsStatus !== "ODDS_COLLECTED" ? `ODDS:${oddsStatus}` : null,
              temporal.missedPreGameWindow ? "MISSED_PRE_GAME_WINDOW" : null,
            ].filter(Boolean),
    };
  });

  if (rows.length !== TOTAL_OBSERVED) throw new Error("DROPPED_GAME");
  const ids = rows.map((r) => r.operatorGameId);
  if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_OPERATOR_GAME");

  const oddsCounts = {
    ODDS_COLLECTED: rows.filter((r) => r.oddsState === "ODDS_COLLECTED").length,
    ODDS_PROVIDER_NO_EVENT: rows.filter((r) => r.oddsState === "ODDS_PROVIDER_NO_EVENT").length,
    ODDS_IDENTITY_BLOCKED: rows.filter((r) => r.oddsState === "ODDS_IDENTITY_BLOCKED").length,
    ODDS_NOT_SUPPORTED: rows.filter((r) => r.oddsState === "ODDS_NOT_SUPPORTED").length,
    MISSED_PRE_GAME_WINDOW: rows.filter((r) => r.oddsState === "MISSED_PRE_GAME_WINDOW").length,
  };
  const temporalCounts = {
    PRE_GAME_OPEN: rows.filter((r) => r.temporalState === "PRE_GAME_OPEN").length,
    MISSED_PRE_GAME_WINDOW: rows.filter((r) => r.temporalState === "MISSED_PRE_GAME_WINDOW").length,
    IDENTITY_BLOCKED: rows.filter((r) => r.temporalState === "IDENTITY_BLOCKED").length,
    PROVIDER_NOT_SUPPORTED: rows.filter((r) => r.temporalState === "PROVIDER_NOT_SUPPORTED").length,
  };

  const coverageDoc = {
    schemaVersion: "yang-edge-pregame-input-odds-coverage-v1",
    dateKst: DATE_KST,
    generatedAt: replayedAt,
    classifiedAt,
    replayedAt,
    rebuildMode: "REPLAY_STORED_OBSERVATION",
    sourceDailyScopeLockRel: LOCK_REL,
    sourceDailyScopeLockHash: SEALED_LOCK_HASH,
    sourceB1ReconciliationRel: RECONCILIATION_REL,
    sourceB1ReconciliationHash: SEALED_RECON_HASH,
    sourceManualOperatorObservationRel: SOURCE_OBS_REL,
    sourceManualOperatorObservationKind: MANUAL_OBS_KIND,
    sourceProviderOddsObservationRel: B2_ODDS_OBS_INDEX_REL,
    sourceProviderOddsObservationHash: SEALED_ODDS_INDEX_HASH,
    sourceProviderOddsObservationObservedAt: oddsIndex.observedAt,
    sourceProviderOddsImmutableCaptureRel: B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL,
    sourceProviderOddsImmutableCaptureHash: SEALED_ODDS_IMMUTABLE_CAPTURE_HASH,
    lockedScope: TOTAL_OBSERVED,
    accountedFor: rows.length,
    researchOnly: true,
    predictionInput: false,
    engineInput: false,
    marketBenchmarkOnly: true,
    engineAdmission: "PROHIBITED",
    prediction: "NONE",
    engine: "NONE",
    note: "B2 pregame input + market benchmark. Odds are not YANG model input. Independent probability vs market implied probability only. B2.1 rebuilds from the stored The Odds API observation; classification must not call the live provider.",
    temporalCounts,
    oddsCounts,
    b1StatusCounts: recon.statusCounts,
    missedPreGameWindowCount: rows.filter((r) => r.missedPreGameWindow).length,
    leakage: {
      predictionCalls: 0,
      engineCalls: 0,
      resultCalls: 0,
      postgameCalls: 0,
      unauthorizedCrawling: 0,
      oddsUsedAsModelFeatures: false,
      denominatorChanged: false,
      gamesDropped: false,
      gamesInvented: false,
      historicalCanonicalRewrite: false,
      liveOddsCallsDuringReplay: 0,
    },
    providerUtilization: [
      {
        provider: "API_BASEBALL",
        subscriptionRole: "schedule/identity + raw standings/form evidence",
        liveCallsThisMission: 0,
        liveCallsThisRebuild: 0,
        cacheHits: 4,
        quotaBefore: "NOT_EXPOSED",
        quotaAfter: "NOT_EXPOSED",
        dataCategoriesCollected: [
          "fixture/game identity",
          "scheduled start time",
          "team identity",
          "league standings raw",
          "kbo recent completed form as-of",
        ],
        operatorGamesCovered: 11,
        usefulRows: 11,
        blockedRows: 0,
        reasonForBlockedRows: null,
      },
      {
        provider: "THE_ODDS_API",
        subscriptionRole: "current pregame market benchmark",
        liveCallsThisMission: ORIGINAL_B2_ODDS_LIVE_CALLS.actualLiveCallsDuringOriginalB2,
        liveCallsThisRebuild: 0,
        actualLiveCallsDuringOriginalB2:
          ORIGINAL_B2_ODDS_LIVE_CALLS.actualLiveCallsDuringOriginalB2,
        intendedCollectionCalls: ORIGINAL_B2_ODDS_LIVE_CALLS.intendedCollectionCalls,
        unintendedRebuildCalls: ORIGINAL_B2_ODDS_LIVE_CALLS.unintendedRebuildCalls,
        rebuildRequiresLiveProvider: false,
        futureExpectedCallsForEquivalentCollection:
          ORIGINAL_B2_ODDS_LIVE_CALLS.futureExpectedCallsForEquivalentCollection,
        cacheHits: 0,
        quotaBefore: 180,
        quotaAfter: 176,
        dataCategoriesCollected: ["h2h moneyline"],
        operatorGamesCovered: 11,
        usefulRows: oddsCounts.ODDS_COLLECTED,
        blockedRows: 15,
        reasonForBlockedRows:
          "Football identity unresolved; volleyball unsupported; missed windows not backdated.",
        sportKeys: oddsIndex.sportKeys,
        calls: historicalCalls,
        observationRels: [B2_ODDS_OBS_INDEX_REL, B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL],
        replaySourceRel: B2_ODDS_OBS_INDEX_REL,
        note: "Historical truth: 4 live h2h calls during original B2 (2 intended collection + 2 unintended classification rebuild). B2.1 replays the stored index and must not add live calls. Neither observation was overwritten.",
      },
      {
        provider: "API_FOOTBALL",
        subscriptionRole: "fixtures already captured in B1.1; extra pregame raw unused",
        liveCallsThisMission: 0,
        liveCallsThisRebuild: 0,
        cacheHits: 1,
        quotaBefore: "NOT_EXPOSED",
        quotaAfter: "NOT_EXPOSED",
        dataCategoriesCollected: ["reused date fixtures dump", "reused schedule-v1"],
        operatorGamesCovered: 0,
        usefulRows: 0,
        blockedRows: 14,
        reasonForBlockedRows:
          "B1 football identity fail-closed. Injuries/lineups/standings clients exist raw-only and were not called.",
        reusedCaptureRel: FIXTURES_CAPTURE_REL,
      },
      {
        provider: "THESPORTSDB",
        subscriptionRole: "NPB schedule already collected in B1",
        liveCallsThisMission: 0,
        liveCallsThisRebuild: 0,
        cacheHits: 0,
        quotaBefore: "NOT_EXPOSED",
        quotaAfter: "NOT_EXPOSED",
        dataCategoriesCollected: [],
        operatorGamesCovered: 6,
        usefulRows: 6,
        blockedRows: 0,
        reasonForBlockedRows: "No additional B2 call. B1 NPB schedule reused.",
      },
    ],
    games: rows,
  };

  const coverageHash = await writeJson(B2_COVERAGE_REL, coverageDoc, cwd);

  const gapDoc = {
    schemaVersion: "yang-edge-provider-coverage-gap-v1",
    dateKst: DATE_KST,
    generatedAt: replayedAt,
    researchOnly: true,
    predictionInput: false,
    engineInput: false,
    currentlyPaidOrUsed: [
      { provider: "API_BASEBALL", role: "KBO/NPB schedule identity + raw standings" },
      { provider: "THE_ODDS_API", role: "KBO/NPB h2h market benchmark" },
      { provider: "API_FOOTBALL", role: "football fixtures already captured; unused extra pregame" },
      { provider: "THESPORTSDB", role: "NPB schedule already collected in B1" },
    ],
    usefulDataActuallyProvided: [
      "KBO/NPB fixture identity and kickoff",
      "KBO cached season games for as-of recent form",
      "KBO/NPB league standings raw snapshots",
      "The Odds API h2h events for baseball sport keys",
    ],
    gaps: [
      {
        gap: "Football 14/14 operator rows not MATCHED",
        cause: "identity mapping / competition registry / truncated aliases / K League ID conflicts",
        classification: "FIX_REPOSITORY_FIRST",
        notAReasonToBuyAnotherApi: true,
      },
      {
        gap: "Football injuries/lineups/standings not attached",
        cause: "adapter not implemented for YANG + operator identity unresolved",
        classification: "USE_EXISTING_API_MORE",
        notAReasonToBuyAnotherApi: true,
      },
      {
        gap: "API-BASEBALL starters/injuries/lineups",
        cause: "provider missing coverage (no players/injuries/lineups endpoints)",
        classification: "NO_ACTION",
        notAReasonToBuyAnotherApi: true,
      },
      {
        gap: "NPB recent form / team season stats not normalized",
        cause: "adapter not implemented; extra per-team calls avoided",
        classification: "USE_EXISTING_API_MORE",
        notAReasonToBuyAnotherApi: true,
      },
      {
        gap: "리그스컵 already started",
        cause: "temporal miss",
        classification: "NO_ACTION",
        notAReasonToBuyAnotherApi: true,
      },
      {
        gap: "한국W : 홍콩W volleyball",
        cause: "unsupported sport / no lawful volleyball provider",
        classification: "CONSIDER_NEW_API",
        purchaseDecision: "NONE",
        candidate: "API_VOLLEYBALL",
        noIntegrationThisMission: true,
      },
    ],
    oddsReplayArchitecture: {
      defect:
        "B2 builder mixed COLLECT (TheOddsApiProvider.getOdds) with CLASSIFY/BUILD; a coverage rebuild spent 2 extra live units",
      classification: "FIX_REPOSITORY_FIRST",
      actualLiveCallsDuringOriginalB2:
        ORIGINAL_B2_ODDS_LIVE_CALLS.actualLiveCallsDuringOriginalB2,
      intendedCollectionCalls: ORIGINAL_B2_ODDS_LIVE_CALLS.intendedCollectionCalls,
      unintendedRebuildCalls: ORIGINAL_B2_ODDS_LIVE_CALLS.unintendedRebuildCalls,
      rebuildRequiresLiveProvider: false,
      futureExpectedCallsForEquivalentCollection:
        ORIGINAL_B2_ODDS_LIVE_CALLS.futureExpectedCallsForEquivalentCollection,
      replaySourceRel: B2_ODDS_OBS_INDEX_REL,
      immutableCaptureRel: B2_ODDS_OBS_IMMUTABLE_CAPTURE_REL,
    },
    footballUnresolvedMustNotAttachProviderInput: true,
    oddsAreBenchmarkNotModelInput: true,
  };
  const gapHash = await writeJson(B2_GAP_REL, gapDoc, cwd);

  return {
    coverageRel: coverageHash.rel,
    coverageSha256: coverageHash.sha256,
    gapRel: gapHash.rel,
    gapSha256: gapHash.sha256,
    oddsRel: B2_ODDS_OBS_INDEX_REL,
    oddsSha256: SEALED_ODDS_INDEX_HASH,
    liveOddsCallsDuringReplay: 0,
    document: coverageDoc,
  };
}

async function main() {
  const collect = process.argv.includes("--collect-odds");
  const result = await runPregameInputOddsCoverage(process.cwd(), {
    mode: collect ? "collect" : "replay",
  });
  const c = result.document;
  const oddsUtil = c.providerUtilization.find((p) => p.provider === "THE_ODDS_API");
  console.log(
    JSON.stringify(
      {
        coverageRel: result.coverageRel,
        coverageSha256: result.coverageSha256,
        gapRel: result.gapRel,
        gapSha256: result.gapSha256,
        oddsRel: result.oddsRel,
        oddsSha256: result.oddsSha256,
        rebuildMode: c.rebuildMode,
        lockedScope: c.lockedScope,
        accountedFor: c.accountedFor,
        temporalCounts: c.temporalCounts,
        oddsCounts: c.oddsCounts,
        liveOddsCallsDuringReplay: result.liveOddsCallsDuringReplay,
        actualLiveCallsDuringOriginalB2: oddsUtil && "actualLiveCallsDuringOriginalB2" in oddsUtil
          ? oddsUtil.actualLiveCallsDuringOriginalB2
          : null,
        intendedCollectionCalls:
          oddsUtil && "intendedCollectionCalls" in oddsUtil
            ? oddsUtil.intendedCollectionCalls
            : null,
        unintendedRebuildCalls:
          oddsUtil && "unintendedRebuildCalls" in oddsUtil
            ? oddsUtil.unintendedRebuildCalls
            : null,
        rebuildRequiresLiveProvider:
          oddsUtil && "rebuildRequiresLiveProvider" in oddsUtil
            ? oddsUtil.rebuildRequiresLiveProvider
            : null,
        futureExpectedCallsForEquivalentCollection:
          oddsUtil && "futureExpectedCallsForEquivalentCollection" in oddsUtil
            ? oddsUtil.futureExpectedCallsForEquivalentCollection
            : null,
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
