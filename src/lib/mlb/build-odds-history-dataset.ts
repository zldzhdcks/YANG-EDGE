/**
 * MLB Odds History Dataset v1 builder — independent intake.
 *
 * Schedule artifact (required) → The Odds API (authorized) → odds-history artifact
 * Prediction Snapshot is optional supplemental metadata only (never required).
 * Movement compares only against a previous odds-history artifact for the same date.
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GameData } from "@/types/game";
import { removeBookmakerMargin } from "../market/remove-bookmaker-margin";
import {
  matchOddsToGame,
  normalizeTeamNameForOdds,
} from "../odds/match-odds-to-game";
import { buildOddsData } from "../odds/odds-provider";
import { marketProbabilityFromDecimalPair } from "../odds/normalize-odds-price";
import type { OddsBookmaker, OddsData } from "../odds/types";
import type { OddsPriceFormat } from "../odds/normalize-odds-price";
import { loadMlbScheduleArtifact } from "./build-mlb-schedule-artifact";
import {
  EMPTY_PREDICTION_HASH,
  parseOptionalPredictionSnapshot,
  type MlbOptionalPredictionSnapshot,
} from "./load-mlb-schedule-targets";
import type { MlbScheduleArtifactGame } from "./mlb-schedule-artifact-types";
import {
  createCacheUsage,
  type CacheUsageStats,
} from "./research-stats-cache";
import {
  ODDS_HISTORY_BUILDER_VERSION,
  ODDS_HISTORY_COLLECTION_PHASE,
  ODDS_HISTORY_DATASET_ID,
  ODDS_HISTORY_PROVIDER_ID,
  ODDS_HISTORY_SCHEMA_VERSION,
  type BuildOddsHistoryDatasetResult,
  type OddsCollectionStatus,
  type OddsHistoryDatasetDocument,
  type OddsHistoryDatasetRow,
  type OddsHistoryJoinQuality,
  type OddsHistoryMovement,
  type OddsHistoryProviderSnapshot,
  type OddsNormalizedMarket,
} from "./odds-history-dataset-types";

const ODDS_MOVEMENT_EPS = 0.001;
const COMMENCE_TOLERANCE_MS = 3 * 60 * 60 * 1000;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key]);
  }
  return out;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function roundOdds(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n * 1000) / 1000;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function oddsResearchCacheRoot(cwd = process.cwd()): string {
  return path.join(
    cwd,
    "data",
    "cache",
    "research",
    "mlb",
    "raw",
    "the-odds-api",
  );
}

function oddsCacheFileKey(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}_${params[k]!.replace(/[:/\\]/g, "-")}`)
    .join("__");
}

async function getRawOddsJson(
  cacheKey: string,
  fetcher: () => Promise<unknown>,
  usage: CacheUsageStats,
): Promise<unknown> {
  const file = path.join(oddsResearchCacheRoot(), `${cacheKey}.json`);
  try {
    const raw = await readFile(file, "utf8");
    usage.rawHit += 1;
    return JSON.parse(raw) as unknown;
  } catch {
    usage.rawMiss += 1;
    usage.networkCalls += 1;
    const body = await fetcher();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(body, null, 2)}\n`, "utf8");
    return body;
  }
}

function teamsMatchForOdds(a: string, b: string): boolean {
  const na = normalizeTeamNameForOdds(a);
  const nb = normalizeTeamNameForOdds(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return (
    na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))
  );
}

function decimalToAmerican(decimal: number | null): number | null {
  if (decimal == null || !Number.isFinite(decimal) || decimal <= 1) return null;
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

function pickReferenceTeam(
  baselinePick: string | null,
  homeTeam: string,
  awayTeam: string,
): string {
  if (baselinePick) {
    if (teamsMatchForOdds(baselinePick, homeTeam)) return homeTeam;
    if (teamsMatchForOdds(baselinePick, awayTeam)) return awayTeam;
  }
  return homeTeam;
}

function sideOddsFromProvider(
  odds: OddsData,
  teamName: string,
  homeTeam: string,
  awayTeam: string,
): number | null {
  if (teamsMatchForOdds(teamName, homeTeam)) {
    return roundOdds(odds.bestHomeOdds);
  }
  if (teamsMatchForOdds(teamName, awayTeam)) {
    return roundOdds(odds.bestAwayOdds);
  }
  return null;
}

function marketProbabilityPctFromProvider(
  odds: OddsData,
  referenceTeam: string,
  homeTeam: string,
  awayTeam: string,
): number | null {
  // Guard: both decimal moneyline prices required; never one-sided / American raw.
  const pair = marketProbabilityFromDecimalPair(
    odds.bestHomeOdds,
    odds.bestAwayOdds,
  );
  if (!pair.usable) return null;
  if (
    odds.formatValidationStatus &&
    odds.formatValidationStatus !== "FORMAT_CONFIRMED_DECIMAL" &&
    odds.formatValidationStatus !== "FORMAT_CONVERTED_FROM_AMERICAN"
  ) {
    return null;
  }

  const margin = removeBookmakerMargin({
    home: odds.impliedHomeProbability,
    away: odds.impliedAwayProbability,
    draw: odds.impliedDrawProbability,
  });
  let prob: number | null = null;
  if (teamsMatchForOdds(referenceTeam, homeTeam)) {
    prob = margin.normalized.home;
  } else if (teamsMatchForOdds(referenceTeam, awayTeam)) {
    prob = margin.normalized.away;
  }
  if (prob == null || !Number.isFinite(prob)) return null;
  return Math.round(prob * 1000) / 10;
}

function parseTheOddsApiEvents(
  body: unknown,
  sportKey: string,
  sourceFormat: OddsPriceFormat = "decimal",
): OddsData[] {
  const rawEvents = Array.isArray(body) ? body : [];
  const out: OddsData[] = [];
  for (const raw of rawEvents) {
    const row = asRecord(raw);
    if (!row) continue;
    const id = asString(row.id);
    const homeTeam = asString(row.home_team);
    const awayTeam = asString(row.away_team);
    if (!id || !homeTeam || !awayTeam) continue;

    const bookmakers: OddsBookmaker[] = [];
    for (const bmRaw of (row.bookmakers as unknown[]) ?? []) {
      const bm = asRecord(bmRaw);
      if (!bm) continue;
      const key = asString(bm.key);
      if (!key) continue;
      bookmakers.push({
        key,
        title: asString(bm.title) ?? key,
        lastUpdate: asString(bm.last_update) ?? "",
        markets: ((bm.markets as unknown[]) ?? []).map((mRaw) => {
          const m = asRecord(mRaw);
          return {
            key: asString(m?.key) ?? "",
            lastUpdate: asString(m?.last_update) ?? "",
            outcomes: ((m?.outcomes as unknown[]) ?? [])
              .map((oRaw) => {
                const o = asRecord(oRaw);
                const name = asString(o?.name);
                const price = asNumber(o?.price);
                if (!name || price == null) return null;
                const point = asNumber(o?.point);
                return { name, price, point };
              })
              .filter(
                (
                  o,
                ): o is { name: string; price: number; point: number | null } =>
                  o != null,
              ),
          };
        }),
      });
    }

    const commenceTime = asString(row.commence_time) ?? "";
    const lastUpdated =
      bookmakers[0]?.lastUpdate || commenceTime || new Date().toISOString();

    out.push(
      buildOddsData({
        externalEventId: id,
        sportKey: asString(row.sport_key) ?? sportKey,
        homeTeam,
        awayTeam,
        commenceTime,
        bookmakers,
        lastUpdated,
        source: "the-odds-api",
        sourceFormat,
      }),
    );
  }
  return out;
}

function scheduleGameToGameData(
  dateKst: string,
  game: MlbScheduleArtifactGame,
): GameData {
  return {
    id: game.internalGameId,
    sport: "baseball",
    league: "MLB",
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    startTime: game.startTimeKst ?? "TBD",
    date: dateKst,
    aiAnalysisAvailable: false,
  };
}

type MatchResult =
  | { kind: "MATCHED"; odds: OddsData; method: string }
  | { kind: "AMBIGUOUS_MATCH"; count: number }
  | { kind: "MATCH_NOT_FOUND" };

function matchProviderEvent(
  dateKst: string,
  game: MlbScheduleArtifactGame,
  events: OddsData[],
): MatchResult {
  const gameData = scheduleGameToGameData(dateKst, game);
  const candidates: OddsData[] = [];

  for (const odds of events) {
    const hit = matchOddsToGame(gameData, [odds], {
      commenceToleranceMs: COMMENCE_TOLERANCE_MS,
      minConfidence: 0.7,
    });
    if (hit) candidates.push(odds);
  }

  if (candidates.length === 0) return { kind: "MATCH_NOT_FOUND" };
  if (candidates.length > 1) {
    return { kind: "AMBIGUOUS_MATCH", count: candidates.length };
  }

  const single = matchOddsToGame(gameData, candidates, {
    commenceToleranceMs: COMMENCE_TOLERANCE_MS,
    minConfidence: 0.7,
  });
  if (!single) return { kind: "MATCH_NOT_FOUND" };
  return { kind: "MATCHED", odds: single.odds, method: single.method };
}

function bestOutcomePrice(
  odds: OddsData,
  marketKey: string,
  nameMatcher: (name: string) => boolean,
): { price: number; point: number | null; bookmaker: string } | null {
  let best: { price: number; point: number | null; bookmaker: string } | null =
    null;
  for (const bm of odds.bookmakers) {
    for (const market of bm.markets) {
      if (market.key !== marketKey) continue;
      for (const outcome of market.outcomes) {
        if (!nameMatcher(outcome.name)) continue;
        const point =
          typeof outcome.point === "number" && Number.isFinite(outcome.point)
            ? outcome.point
            : null;
        if (!best || outcome.price > best.price) {
          best = {
            price: outcome.price,
            point,
            bookmaker: bm.title || bm.key,
          };
        }
      }
    }
  }
  return best;
}

function extractPointFromOutcomes(
  odds: OddsData,
  marketKey: string,
): number | null {
  for (const bm of odds.bookmakers) {
    for (const market of bm.markets) {
      if (market.key !== marketKey) continue;
      for (const outcome of market.outcomes as Array<{
        name: string;
        price: number;
        point?: number;
      }>) {
        if (typeof outcome.point === "number" && Number.isFinite(outcome.point)) {
          return outcome.point;
        }
      }
    }
  }
  return null;
}

function buildNormalizedMarkets(
  odds: OddsData | null,
  homeTeam: string,
  awayTeam: string,
  capturedAt: string | null,
  statusReason: string | null,
): OddsNormalizedMarket[] {
  const mk = (
    marketType: OddsNormalizedMarket["marketType"],
    selection: string,
    price: number | null,
    point: number | null,
    bookmaker: string | null,
    ok: boolean,
    reason: string | null,
  ): OddsNormalizedMarket => ({
    marketType,
    selection,
    priceAmerican: decimalToAmerican(price),
    priceDecimal: roundOdds(price),
    point,
    bookmaker,
    capturedAt: ok ? capturedAt : null,
    status: ok ? "COLLECTED" : "NOT_COLLECTED",
    reason: ok ? null : reason,
  });

  if (!odds) {
    const reason =
      statusReason ??
      "No authorized odds provider response was available for this game.";
    return [
      mk("moneyline", "home", null, null, null, false, reason),
      mk("moneyline", "away", null, null, null, false, reason),
      mk("run_line", "home", null, null, null, false, reason),
      mk("run_line", "away", null, null, null, false, reason),
      mk("total", "over", null, null, null, false, reason),
      mk("total", "under", null, null, null, false, reason),
    ];
  }

  const homeMl = roundOdds(odds.bestHomeOdds);
  const awayMl = roundOdds(odds.bestAwayOdds);
  const spreadHome = bestOutcomePrice(odds, "spreads", (n) =>
    teamsMatchForOdds(n, homeTeam),
  );
  const spreadAway = bestOutcomePrice(odds, "spreads", (n) =>
    teamsMatchForOdds(n, awayTeam),
  );
  const totalOver = bestOutcomePrice(
    odds,
    "totals",
    (n) => n.toLowerCase() === "over",
  );
  const totalUnder = bestOutcomePrice(
    odds,
    "totals",
    (n) => n.toLowerCase() === "under",
  );
  const spreadPoint =
    spreadHome?.point ??
    spreadAway?.point ??
    extractPointFromOutcomes(odds, "spreads");
  const totalPoint =
    totalOver?.point ??
    totalUnder?.point ??
    extractPointFromOutcomes(odds, "totals");

  return [
    mk(
      "moneyline",
      "home",
      homeMl,
      null,
      homeMl != null ? "AGGREGATE_BEST" : null,
      homeMl != null,
      homeMl != null ? null : "Moneyline home price not available.",
    ),
    mk(
      "moneyline",
      "away",
      awayMl,
      null,
      awayMl != null ? "AGGREGATE_BEST" : null,
      awayMl != null,
      awayMl != null ? null : "Moneyline away price not available.",
    ),
    mk(
      "run_line",
      "home",
      spreadHome ? roundOdds(spreadHome.price) : null,
      spreadPoint,
      spreadHome?.bookmaker ?? null,
      spreadHome != null,
      spreadHome != null ? null : "Run line market not available from provider.",
    ),
    mk(
      "run_line",
      "away",
      spreadAway ? roundOdds(spreadAway.price) : null,
      spreadPoint != null ? -spreadPoint : null,
      spreadAway?.bookmaker ?? null,
      spreadAway != null,
      spreadAway != null ? null : "Run line market not available from provider.",
    ),
    mk(
      "total",
      "over",
      totalOver ? roundOdds(totalOver.price) : null,
      totalPoint,
      totalOver?.bookmaker ?? null,
      totalOver != null,
      totalOver != null ? null : "Total market not available from provider.",
    ),
    mk(
      "total",
      "under",
      totalUnder ? roundOdds(totalUnder.price) : null,
      totalPoint,
      totalUnder?.bookmaker ?? null,
      totalUnder != null,
      totalUnder != null ? null : "Total market not available from provider.",
    ),
  ];
}

function computeMovement(
  opening: number | null,
  latest: number | null,
  hasPreviousSnapshot: boolean,
): OddsHistoryMovement {
  if (!hasPreviousSnapshot) return "NOT_COLLECTED";
  if (opening == null || latest == null) return "NOT_COLLECTED";
  const delta = latest - opening;
  if (Math.abs(delta) <= ODDS_MOVEMENT_EPS) return "UNCHANGED";
  return delta > 0 ? "UP" : "DOWN";
}

async function loadPreviousOddsRows(
  dateKst: string,
): Promise<Map<string, OddsHistoryDatasetRow>> {
  const prevPath = path.join(
    process.cwd(),
    "data/research/mlb",
    `${dateKst}-odds-history-dataset-v1.json`,
  );
  if (!(await fileExists(prevPath))) return new Map();
  try {
    const root = JSON.parse(await readFile(prevPath, "utf8")) as {
      rows?: OddsHistoryDatasetRow[];
    };
    const map = new Map<string, OddsHistoryDatasetRow>();
    for (const row of root.rows ?? []) {
      if (row.gameId) map.set(row.gameId, row);
    }
    return map;
  } catch {
    return new Map();
  }
}

type ProviderFetchResult = {
  sportKey: string | null;
  events: OddsData[];
  fetched: boolean;
  error: string | null;
};

async function fetchOddsApiEventsForDate(
  dateKst: string,
  usage: CacheUsageStats,
): Promise<ProviderFetchResult> {
  const apiKey = (process.env.ODDS_API_KEY ?? "").trim();
  const baseUrl =
    (process.env.ODDS_API_BASE_URL ?? "").trim() ||
    "https://api.the-odds-api.com/v4";

  if (!apiKey) {
    return {
      sportKey: null,
      events: [],
      fetched: false,
      error: "ODDS_API_KEY is not configured.",
    };
  }

  try {
    let resolvedSportKey: string | null = null;
    const sportsBody = (await getRawOddsJson(
      "sports_list",
      async () => {
        const url = new URL(`${baseUrl}/sports`);
        url.searchParams.set("apiKey", apiKey);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`Odds API /sports HTTP ${res.status}`);
        return res.json();
      },
      usage,
    )) as unknown[];

    for (const raw of Array.isArray(sportsBody) ? sportsBody : []) {
      const row = asRecord(raw);
      const key = asString(row?.key);
      const title = asString(row?.title) ?? "";
      if (key === "baseball_mlb" || title.toLowerCase().includes("mlb")) {
        resolvedSportKey = key;
        break;
      }
    }

    if (!resolvedSportKey) {
      return {
        sportKey: null,
        events: [],
        fetched: false,
        error: "MLB sport key not found in Odds API /sports.",
      };
    }

    const dayStart = new Date(`${dateKst}T00:00:00+09:00`);
    const dayEnd = new Date(`${dateKst}T24:00:00+09:00`);
    const params = {
      sportKey: resolvedSportKey,
      regions: "eu",
      markets: "h2h,spreads,totals",
      commenceTimeFrom: dayStart.toISOString().replace(".000Z", "Z"),
      commenceTimeTo: dayEnd.toISOString().replace(".000Z", "Z"),
      oddsFormat: "decimal",
    };

    const body = await getRawOddsJson(
      oddsCacheFileKey(params),
      async () => {
        const url = new URL(
          `${baseUrl}/sports/${encodeURIComponent(resolvedSportKey!)}/odds`,
        );
        url.searchParams.set("apiKey", apiKey);
        url.searchParams.set("regions", params.regions);
        url.searchParams.set("markets", params.markets);
        url.searchParams.set("commenceTimeFrom", params.commenceTimeFrom);
        url.searchParams.set("commenceTimeTo", params.commenceTimeTo);
        url.searchParams.set("oddsFormat", "decimal");
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`Odds API odds HTTP ${res.status}`);
        return res.json();
      },
      usage,
    );

    return {
      sportKey: resolvedSportKey,
      events: parseTheOddsApiEvents(body, resolvedSportKey, "decimal"),
      fetched: true,
      error: null,
    };
  } catch (e) {
    return {
      sportKey: null,
      events: [],
      fetched: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function hashableRowBody(row: OddsHistoryDatasetRow): Record<string, unknown> {
  return {
    gameId: row.gameId,
    gameDate: row.gameDate,
    collectionPhase: row.collectionPhase,
    collectionStatus: row.collectionStatus ?? null,
    reason: row.reason ?? null,
    joinQuality: row.joinQuality,
    openingOdds: row.openingOdds,
    latestOdds: row.latestOdds,
    marketProbability: row.marketProbability,
    provider: row.provider,
    bookmaker: row.bookmaker,
    marketType: row.marketType,
    movement: row.movement,
    capturedAt: row.capturedAt,
    oddsEventId: row.oddsEventId,
    bookmakerCount: row.bookmakerCount,
    cutoffTime: row.cutoffTime,
    markets: row.markets ?? [],
    missing: row.missing,
    warnings: row.warnings,
  };
}

export function assertOddsHistoryDatasetIntegrity(
  document: OddsHistoryDatasetDocument,
): string[] {
  const issues: string[] = [];
  if (document.meta.engineAdmission !== "PROHIBITED") {
    issues.push("engineAdmission must be PROHIBITED");
  }
  if (document.meta.legal.closingOddsCollected !== false) {
    issues.push("closingOddsCollected must be false");
  }
  for (const row of document.rows) {
    if (row.collectionPhase !== ODDS_HISTORY_COLLECTION_PHASE) {
      issues.push(`${row.gameId}: invalid collectionPhase`);
    }
    const allowed: OddsHistoryMovement[] = [
      "UP",
      "DOWN",
      "UNCHANGED",
      "NOT_COLLECTED",
    ];
    if (!allowed.includes(row.movement)) {
      issues.push(`${row.gameId}: invalid movement ${row.movement}`);
    }
  }
  return issues;
}

export async function buildOddsHistoryDatasetV1(input: {
  dateKst: string;
  predictionRaw?: string | null;
}): Promise<BuildOddsHistoryDatasetResult> {
  const usage = createCacheUsage();

  // Schedule artifact is required — fail hard if missing (Scenario C).
  const schedule = await loadMlbScheduleArtifact(input.dateKst);
  const scheduleSource = `data/research/mlb/${input.dateKst}-schedule-v1.json`;

  const optionalPrediction: MlbOptionalPredictionSnapshot | null =
    input.predictionRaw != null && input.predictionRaw.trim() !== ""
      ? parseOptionalPredictionSnapshot(input.predictionRaw, input.dateKst)
      : null;
  const predictionHash = optionalPrediction?.hash ?? EMPTY_PREDICTION_HASH;

  const previousRows = await loadPreviousOddsRows(input.dateKst);
  const hasPreviousSnapshot = previousRows.size > 0;

  const oddsFetch = await fetchOddsApiEventsForDate(input.dateKst, usage);
  const generatedAt = new Date().toISOString();
  const rows: OddsHistoryDatasetRow[] = [];

  const joinQualityCounts: Record<OddsHistoryJoinQuality, number> = {
    MATCHED: 0,
    MISSING_ODDS: 0,
    TIMELINE_ONLY: 0,
  };
  const movementCounts: Record<OddsHistoryMovement, number> = {
    UP: 0,
    DOWN: 0,
    UNCHANGED: 0,
    NOT_COLLECTED: 0,
  };
  const statusCounts: Record<OddsCollectionStatus, number> = {
    COLLECTED: 0,
    PARTIAL: 0,
    NOT_COLLECTED: 0,
    PROVIDER_ERROR: 0,
    MATCH_NOT_FOUND: 0,
    INVALID_RESPONSE: 0,
    FORMAT_MISMATCH: 0,
    ODDS_AFTER_CUTOFF: 0,
    TEAM_MAPPING_FAILED: 0,
    MARKET_NOT_AVAILABLE: 0,
  };

  let openingCollected = 0;
  let latestCollected = 0;
  let marketProbabilityCollected = 0;

  for (const game of schedule.games) {
    const missing: string[] = [];
    const warnings: string[] = ["INDEPENDENT_ODDS_INTAKE_V1"];

    const predEntry =
      optionalPrediction?.entries.find(
        (e) =>
          teamsMatchForOdds(e.homeTeam, game.homeTeam) &&
          teamsMatchForOdds(e.awayTeam, game.awayTeam),
      ) ?? null;
    if (predEntry) {
      warnings.push("PREDICTION_SUPPLEMENTAL_ONLY");
    }

    const baselinePick = predEntry?.baselinePick ?? null;
    const referenceTeam = pickReferenceTeam(
      baselinePick,
      game.homeTeam,
      game.awayTeam,
    );

    let collectionStatus: OddsCollectionStatus;
    let reason: string;
    let providerOdds: OddsData | null = null;
    let matchMethod: string | null = null;

    if (oddsFetch.error && !oddsFetch.fetched) {
      collectionStatus = "PROVIDER_ERROR";
      reason = oddsFetch.error;
      warnings.push(`PROVIDER_ERROR=${oddsFetch.error}`);
    } else if (oddsFetch.events.length === 0) {
      collectionStatus = "NOT_COLLECTED";
      reason =
        "No authorized odds provider response was available for this game.";
      warnings.push("NOT_COLLECTED_REASON=PROVIDER_EVENT_MISSING");
    } else {
      const match = matchProviderEvent(
        input.dateKst,
        game,
        oddsFetch.events,
      );
      if (match.kind === "MATCH_NOT_FOUND") {
        collectionStatus = "MATCH_NOT_FOUND";
        reason = "PROVIDER_EVENT_MISSING: no schedule-matched provider event.";
        warnings.push("MATCH_NOT_FOUND");
        warnings.push("NOT_COLLECTED_REASON=NO_PROVIDER_MATCH");
      } else if (match.kind === "AMBIGUOUS_MATCH") {
        collectionStatus = "MATCH_NOT_FOUND";
        reason = `AMBIGUOUS_MATCH: ${match.count} provider events matched.`;
        warnings.push(`AMBIGUOUS_MATCH=${match.count}`);
      } else {
        providerOdds = match.odds;
        matchMethod = match.method;
        warnings.push(`PROVIDER_MATCH=${match.method}`);

        const formatStatus = providerOdds.formatValidationStatus;
        if (
          formatStatus === "FORMAT_MISMATCH" ||
          formatStatus === "FORMAT_UNKNOWN"
        ) {
          collectionStatus = "FORMAT_MISMATCH";
          reason =
            formatStatus === "FORMAT_MISMATCH"
              ? "ODDS_FORMAT_MISMATCH: provider payload is not safe decimal."
              : "ODDS_FORMAT_UNKNOWN: cannot safely normalize moneyline prices.";
          warnings.push(formatStatus);
          warnings.push(
            ...(providerOdds.formatPartialReasons ?? []).map(
              (r) => `PARTIAL_REASON=${r}`,
            ),
          );
        } else {
          const homeOk = providerOdds.bestHomeOdds != null;
          const awayOk = providerOdds.bestAwayOdds != null;
          if (!homeOk && !awayOk) {
            collectionStatus = "INVALID_RESPONSE";
            reason = "Provider event matched but h2h prices were invalid.";
            warnings.push("INVALID_RESPONSE");
          } else if (!homeOk || !awayOk) {
            collectionStatus = "PARTIAL";
            reason = "Provider matched but moneyline is incomplete.";
            if (!homeOk) warnings.push("PARTIAL_REASON=HOME_OUTCOME_MISSING");
            if (!awayOk) warnings.push("PARTIAL_REASON=AWAY_OUTCOME_MISSING");
          } else {
            collectionStatus = "COLLECTED";
            reason = "Moneyline collected from authorized Odds Provider.";
          }
        }
      }
    }

    const capturedAt = providerOdds?.lastUpdated ?? null;
    if (
      capturedAt &&
      game.commenceTimeUtc &&
      Date.parse(capturedAt) >= Date.parse(game.commenceTimeUtc) &&
      (collectionStatus === "COLLECTED" || collectionStatus === "PARTIAL")
    ) {
      collectionStatus = "ODDS_AFTER_CUTOFF";
      reason = "ODDS_AFTER_CUTOFF: capturedAt >= scheduledStartTime.";
      warnings.push("ODDS_AFTER_CUTOFF");
    }

    const markets = buildNormalizedMarkets(
      providerOdds,
      game.homeTeam,
      game.awayTeam,
      capturedAt,
      reason,
    );
    warnings.push(
      `H2H_HOME=${providerOdds?.bestHomeOdds ?? "NOT_COLLECTED"}|AWAY=${providerOdds?.bestAwayOdds ?? "NOT_COLLECTED"}|DRAW=${providerOdds?.bestDrawOdds ?? "NOT_COLLECTED"}`,
    );
    if (capturedAt) warnings.push(`COLLECTED_AT=${capturedAt}`);

    const currentPrice = providerOdds
      ? sideOddsFromProvider(
          providerOdds,
          referenceTeam,
          game.homeTeam,
          game.awayTeam,
        )
      : null;

    const prev = previousRows.get(game.internalGameId) ?? null;
    let openingOdds: number | null = null;
    let latestOdds: number | null = null;

    if (currentPrice != null) {
      // Freeze opening from prior odds-history snapshot when present; never invent.
      openingOdds =
        prev?.openingOdds != null ? prev.openingOdds : currentPrice;
      latestOdds = currentPrice;
    }

    const marketProbability = providerOdds
      ? marketProbabilityPctFromProvider(
          providerOdds,
          referenceTeam,
          game.homeTeam,
          game.awayTeam,
        )
      : null;

    if (openingOdds == null) missing.push("openingOdds");
    if (latestOdds == null) missing.push("latestOdds");
    if (marketProbability == null) missing.push("marketProbability");

    const moneylineCollected = markets
      .filter((m) => m.marketType === "moneyline")
      .every((m) => m.status === "COLLECTED");
    const anyMarketCollected = markets.some((m) => m.status === "COLLECTED");
    if (
      collectionStatus === "COLLECTED" &&
      !moneylineCollected &&
      anyMarketCollected
    ) {
      collectionStatus = "PARTIAL";
      reason = "Some markets collected; moneyline incomplete.";
    }

    let joinQuality: OddsHistoryJoinQuality = "MISSING_ODDS";
    if (collectionStatus === "COLLECTED") joinQuality = "MATCHED";
    else if (collectionStatus === "PARTIAL" && openingOdds != null) {
      joinQuality = "MATCHED";
    }

    if (openingOdds != null) openingCollected += 1;
    if (latestOdds != null) latestCollected += 1;
    if (marketProbability != null) marketProbabilityCollected += 1;

    const movement = computeMovement(
      openingOdds,
      latestOdds,
      hasPreviousSnapshot,
    );
    if (!hasPreviousSnapshot) {
      warnings.push("MOVEMENT_NOT_COLLECTED_NO_PREVIOUS_ODDS_SNAPSHOT");
    }

    movementCounts[movement] += 1;
    joinQualityCounts[joinQuality] += 1;
    statusCounts[collectionStatus] += 1;

    const provider: OddsHistoryProviderSnapshot = oddsFetch.sportKey
      ? {
          id: ODDS_HISTORY_PROVIDER_ID,
          displayName: "The Odds API",
          sportKey: oddsFetch.sportKey,
        }
      : {
          id: "NOT_COLLECTED",
          displayName: "NOT_COLLECTED",
          sportKey: null,
        };

    if (provider.id === "NOT_COLLECTED") {
      missing.push("provider");
    }

    const bookmaker =
      openingOdds != null || latestOdds != null
        ? ("AGGREGATE_BEST" as const)
        : null;

    if (!capturedAt) missing.push("capturedAt");

    const rowInputHash = sha256(
      stableStringify({
        gameId: game.internalGameId,
        scheduleSource,
        predictionHash,
        providerEventId: providerOdds?.externalEventId ?? null,
        matchMethod,
        openingOdds,
        latestOdds,
        marketProbability,
        collectionStatus,
        sportKey: provider.sportKey,
      }),
    );

    const rowBody: Omit<OddsHistoryDatasetRow, "inputHash" | "resultHash"> = {
      schemaVersion: ODDS_HISTORY_SCHEMA_VERSION,
      builderVersion: ODDS_HISTORY_BUILDER_VERSION,
      generatedAt,
      gameDate: input.dateKst,
      gameId: game.internalGameId,
      internalGameId: game.internalGameId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      startTimeKst: game.startTimeKst,
      baselinePick,
      collectionPhase: ODDS_HISTORY_COLLECTION_PHASE,
      cutoffTime: game.commenceTimeUtc,
      researchOnly: true,
      legalStatus: "REFERENCE_ODDS_RESEARCH_ONLY",
      engineUseAllowed: false,
      joinQuality,
      collectionStatus,
      reason,
      partialReasons: [
        ...new Set([
          ...(providerOdds?.formatPartialReasons ?? []),
          ...warnings
            .filter((w) => w.startsWith("PARTIAL_REASON="))
            .map((w) => w.replace("PARTIAL_REASON=", "")),
          ...(collectionStatus === "FORMAT_MISMATCH"
            ? ["FORMAT_MISMATCH"]
            : []),
        ]),
      ],
      oddsFormatDeclared: providerOdds?.oddsFormatDeclared ?? null,
      oddsFormatEffective: providerOdds?.oddsFormatEffective ?? null,
      formatValidationStatus: providerOdds?.formatValidationStatus ?? null,
      fetchedAt: generatedAt,
      marketLastUpdate: capturedAt,
      artifactGeneratedAt: generatedAt,
      openingOdds,
      latestOdds,
      marketProbability:
        collectionStatus === "COLLECTED" ? marketProbability : null,
      provider,
      bookmaker,
      marketType: "h2h",
      movement,
      capturedAt,
      oddsEventId: providerOdds?.externalEventId ?? null,
      bookmakerCount: providerOdds?.bookmakers.length ?? null,
      markets,
      missing: [...new Set(missing)].sort(),
      warnings: [...new Set(warnings)].sort(),
    };

    const resultHash = sha256(
      stableStringify(hashableRowBody(rowBody as OddsHistoryDatasetRow)),
    );

    rows.push({
      ...rowBody,
      inputHash: rowInputHash,
      resultHash,
    });
  }

  rows.sort((a, b) => a.gameId.localeCompare(b.gameId));

  const inputHashSha256 = sha256(
    stableStringify({
      dateKst: input.dateKst,
      scheduleSource,
      predictionHash,
      sportKey: oddsFetch.sportKey,
      hasPreviousSnapshot,
      rowInputs: rows.map((r) => r.inputHash).sort(),
    }),
  );
  const resultHashSha256 = sha256(
    stableStringify(rows.map((r) => hashableRowBody(r))),
  );

  const document: OddsHistoryDatasetDocument = {
    meta: {
      datasetId: ODDS_HISTORY_DATASET_ID,
      schemaVersion: ODDS_HISTORY_SCHEMA_VERSION,
      builderVersion: ODDS_HISTORY_BUILDER_VERSION,
      status: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      engineUseAllowed: false,
      researchOnly: true,
      dateKst: input.dateKst,
      generatedAt,
      predictionHashSha256: predictionHash,
      predictionUnchanged: true,
      inputHashSha256,
      resultHashSha256,
      scheduleSource,
      provider: oddsFetch.sportKey
        ? "The Odds API"
        : "NOT_COLLECTED",
      legal: {
        oddsSource: "REFERENCE_ODDS_PROVIDER",
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
        closingOddsCollected: false,
        postGameOddsCollected: false,
      },
      notes: [
        "PRE_GAME_MARKET only — no closing or post-game odds.",
        "Schedule-artifact-first independent intake.",
        "Primary odds from authorized The Odds API (h2h/spreads/totals).",
        "Prediction Snapshot is optional supplemental metadata only.",
        "Movement compares only previous odds-history artifact (same date).",
        "Engine admission PROHIBITED.",
      ],
    },
    cacheUsage: {
      rawHit: usage.rawHit,
      rawMiss: usage.rawMiss,
      derivedHit: usage.derivedHit,
      derivedMiss: usage.derivedMiss,
      networkCalls: usage.networkCalls,
    },
    summary: {
      totalGames: rows.length,
      openingCollected,
      latestCollected,
      marketProbabilityCollected,
      collectedGames: statusCounts.COLLECTED,
      partialGames: statusCounts.PARTIAL,
      notCollectedGames:
        statusCounts.NOT_COLLECTED +
        statusCounts.MATCH_NOT_FOUND +
        statusCounts.PROVIDER_ERROR +
        statusCounts.INVALID_RESPONSE,
      movement: movementCounts,
      joinQuality: joinQualityCounts,
      collectionStatus: statusCounts,
    },
    rows,
  };

  return { document, usage };
}
