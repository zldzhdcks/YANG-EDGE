/**
 * MLB Odds History Dataset v1 builder — PRE_GAME_MARKET only.
 *
 * - Schedule-first targets (MLB Stats API)
 * - Primary odds: The Odds API h2h (lawful provider, research cache)
 * - Optional prediction snapshot enriches baselinePick / gap-fill only
 * - Optional odds-timeline enrichment for movement when snapshots exist
 * - No Engine / Score / Framework imports
 */
import { createHash } from "node:crypto";
import { removeBookmakerMargin } from "../market/remove-bookmaker-margin";
import { buildOddsData } from "../odds/odds-provider";
import {
  matchOddsToGame,
  normalizeTeamNameForOdds,
} from "../odds/match-odds-to-game";
import type { OddsBookmaker, OddsData } from "../odds/types";
import type { GameData } from "@/types/game";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createCacheUsage,
  type CacheUsageStats,
} from "./research-stats-cache";
import {
  buildMlbScheduleGameTargets,
  EMPTY_PREDICTION_HASH,
  fetchMlbScheduleForDateKst,
  findPredictionForScheduleGame,
  parseOptionalPredictionSnapshot,
  type MlbOptionalPredictionSnapshot,
  type MlbScheduleGameTarget,
} from "./load-mlb-schedule-targets";
import {
  ODDS_HISTORY_BUILDER_VERSION,
  ODDS_HISTORY_COLLECTION_PHASE,
  ODDS_HISTORY_DATASET_ID,
  ODDS_HISTORY_PROVIDER_ID,
  ODDS_HISTORY_SCHEMA_VERSION,
  type BuildOddsHistoryDatasetResult,
  type OddsHistoryDatasetDocument,
  type OddsHistoryDatasetRow,
  type OddsHistoryJoinQuality,
  type OddsHistoryMovement,
  type OddsHistoryProviderSnapshot,
} from "./odds-history-dataset-types";

const ODDS_MOVEMENT_EPS = 0.001;

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
  return path.join(cwd, "data", "cache", "research", "mlb", "raw", "the-odds-api");
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

type ScheduleOddsTarget = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string | null;
  commenceTimeUtc: string;
  baselinePick: string | null;
  predictionOpeningOdds: number | null;
  predictionLatestOdds: number | null;
  predictionMarketProbability: number | null;
  cutoffTime: string | null;
};

type ProviderH2HMarket = {
  homeOdds: number | null;
  awayOdds: number | null;
  drawOdds: number | null;
  marketProbabilityPct: number | null;
  referenceOdds: number | null;
  collectedAt: string;
  oddsEventId: string;
  bookmakerCount: number;
};

function teamsMatchForOdds(a: string, b: string): boolean {
  const na = normalizeTeamNameForOdds(a);
  const nb = normalizeTeamNameForOdds(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return (
    na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))
  );
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

function formatH2HWarning(market: ProviderH2HMarket): string {
  const draw =
    market.drawOdds != null ? String(market.drawOdds) : "NOT_COLLECTED";
  return `H2H_HOME=${market.homeOdds ?? "NOT_COLLECTED"}|AWAY=${market.awayOdds ?? "NOT_COLLECTED"}|DRAW=${draw}`;
}

function parseTheOddsApiEvents(
  body: unknown,
  sportKey: string,
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
                return { name, price };
              })
              .filter((o): o is { name: string; price: number } => o != null),
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
      }),
    );
  }
  return out;
}

function buildScheduleOddsTargets(
  dateKst: string,
  scheduleTargets: MlbScheduleGameTarget[],
  prediction: MlbOptionalPredictionSnapshot | null,
): ScheduleOddsTarget[] {
  return scheduleTargets.map((target) => {
    const matched = prediction
      ? findPredictionForScheduleGame(
          target.scheduleGame,
          dateKst,
          prediction.entries,
        )
      : null;
    return {
      gameId: target.gameId,
      homeTeam: target.homeTeam,
      awayTeam: target.awayTeam,
      startTimeKst: target.startTimeKst,
      commenceTimeUtc: target.commenceTimeUtc,
      baselinePick: matched?.baselinePick ?? null,
      predictionOpeningOdds: matched?.openingOdds ?? null,
      predictionLatestOdds: matched?.latestOdds ?? null,
      predictionMarketProbability: matched?.marketProbability ?? null,
      cutoffTime: matched?.predictedAt ?? target.commenceTimeUtc,
    };
  });
}

function providerMarketFromOdds(
  odds: OddsData,
  referenceTeam: string,
  homeTeam: string,
  awayTeam: string,
  collectedAt: string,
): ProviderH2HMarket {
  return {
    homeOdds: roundOdds(odds.bestHomeOdds),
    awayOdds: roundOdds(odds.bestAwayOdds),
    drawOdds: roundOdds(odds.bestDrawOdds),
    marketProbabilityPct: marketProbabilityPctFromProvider(
      odds,
      referenceTeam,
      homeTeam,
      awayTeam,
    ),
    referenceOdds: sideOddsFromProvider(odds, referenceTeam, homeTeam, awayTeam),
    collectedAt,
    oddsEventId: odds.externalEventId,
    bookmakerCount: odds.bookmakers.length,
  };
}

type TimelineGame = {
  gameId: string;
  oddsEventId: string | null;
  matchStatus: string | null;
  snapshots: Array<{
    capturedAt: string;
    oddsEventId: string;
    pickOdds: number | null;
    marketProbability: number | null;
    bookmakerCount: number;
  }>;
};


async function loadTimelineMap(
  dateKst: string,
): Promise<{ map: Map<string, TimelineGame>; sportKey: string | null }> {
  const timelinePath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${dateKst}-odds-timeline.json`,
  );
  if (!(await fileExists(timelinePath))) {
    return { map: new Map(), sportKey: null };
  }

  const root = JSON.parse(await readFile(timelinePath, "utf8")) as {
    meta?: { sportKey?: string };
    games?: unknown[];
  };
  const map = new Map<string, TimelineGame>();

  for (const raw of root.games ?? []) {
    const row = asRecord(raw);
    if (!row) continue;
    const gameId = asString(row.gameId);
    if (!gameId) continue;

    const snapshotsRaw = Array.isArray(row.snapshots) ? row.snapshots : [];
    const snapshots = snapshotsRaw
      .map((snap) => {
        const s = asRecord(snap);
        if (!s) return null;
        const capturedAt = asString(s.capturedAt);
        const oddsEventId = asString(s.oddsEventId);
        if (!capturedAt || !oddsEventId) return null;
        return {
          capturedAt,
          oddsEventId,
          pickOdds: roundOdds(asNumber(s.pickOdds)),
          marketProbability: asNumber(s.marketProbability),
          bookmakerCount: asNumber(s.bookmakerCount) ?? 0,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);

    map.set(gameId, {
      gameId,
      oddsEventId: asString(row.oddsEventId),
      matchStatus: asString(row.matchStatus),
      snapshots,
    });
  }

  return { map, sportKey: asString(root.meta?.sportKey) };
}

function computeMovement(
  opening: number | null,
  latest: number | null,
): OddsHistoryMovement {
  if (opening == null || latest == null) return "NOT_COLLECTED";
  const delta = latest - opening;
  if (Math.abs(delta) <= ODDS_MOVEMENT_EPS) return "UNCHANGED";
  return delta > 0 ? "UP" : "DOWN";
}

async function fetchOddsApiEventsForDate(
  dateKst: string,
  sportKey: string | null,
  usage: CacheUsageStats,
): Promise<{
  sportKey: string | null;
  events: OddsData[];
  fetched: boolean;
}> {
  const apiKey = (process.env.ODDS_API_KEY ?? "").trim();
  const baseUrl =
    (process.env.ODDS_API_BASE_URL ?? "").trim() ||
    "https://api.the-odds-api.com/v4";

  if (!apiKey) {
    return { sportKey, events: [], fetched: false };
  }

  let resolvedSportKey = sportKey;
  if (!resolvedSportKey) {
    const sportsBody = (await getRawOddsJson(
      "sports_list",
      async () => {
        const url = new URL(`${baseUrl}/sports`);
        url.searchParams.set("apiKey", apiKey);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Odds API /sports HTTP ${res.status}`);
        }
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
  }

  if (!resolvedSportKey) {
    return { sportKey: null, events: [], fetched: false };
  }

  const dayStart = new Date(`${dateKst}T00:00:00+09:00`);
  const dayEnd = new Date(`${dateKst}T24:00:00+09:00`);
  const params = {
    sportKey: resolvedSportKey,
    regions: "eu",
    markets: "h2h",
    commenceTimeFrom: dayStart.toISOString().replace(".000Z", "Z"),
    commenceTimeTo: dayEnd.toISOString().replace(".000Z", "Z"),
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
      if (!res.ok) {
        throw new Error(`Odds API odds HTTP ${res.status}`);
      }
      return res.json();
    },
    usage,
  );

  return {
    sportKey: resolvedSportKey,
    events: parseTheOddsApiEvents(body, resolvedSportKey),
    fetched: true,
  };
}

function hashableRowBody(row: OddsHistoryDatasetRow): Record<string, unknown> {
  return {
    gameId: row.gameId,
    gameDate: row.gameDate,
    collectionPhase: row.collectionPhase,
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
  const optionalPrediction: MlbOptionalPredictionSnapshot | null =
    input.predictionRaw != null && input.predictionRaw.trim() !== ""
      ? parseOptionalPredictionSnapshot(input.predictionRaw, input.dateKst)
      : null;
  const predictionHash = optionalPrediction?.hash ?? EMPTY_PREDICTION_HASH;

  const scheduleAll = await fetchMlbScheduleForDateKst(input.dateKst, usage);
  const scheduleTargets = buildMlbScheduleGameTargets(
    input.dateKst,
    scheduleAll,
    optionalPrediction,
  );
  const targets = buildScheduleOddsTargets(
    input.dateKst,
    scheduleTargets,
    optionalPrediction,
  );
  const { map: timelineMap, sportKey: timelineSportKey } =
    await loadTimelineMap(input.dateKst);

  const oddsFetch = await fetchOddsApiEventsForDate(
    input.dateKst,
    timelineSportKey,
    usage,
  );

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

  let openingCollected = 0;
  let latestCollected = 0;
  let marketProbabilityCollected = 0;

  for (const target of targets) {
    const missing: string[] = [];
    const warnings: string[] = ["INDEPENDENT_ODDS_INTAKE_V1"];
    const timeline = timelineMap.get(target.gameId);
    const referenceTeam = pickReferenceTeam(
      target.baselinePick,
      target.homeTeam,
      target.awayTeam,
    );

    const scheduleGame: GameData = {
      id: target.gameId,
      sport: "baseball",
      league: "MLB",
      homeTeam: target.homeTeam,
      awayTeam: target.awayTeam,
      startTime: target.startTimeKst ?? "TBD",
      date: input.dateKst,
      aiAnalysisAvailable: false,
    };

    const providerMatch = matchOddsToGame(scheduleGame, oddsFetch.events);
    let providerMarket: ProviderH2HMarket | null = null;
    if (providerMatch) {
      providerMarket = providerMarketFromOdds(
        providerMatch.odds,
        referenceTeam,
        target.homeTeam,
        target.awayTeam,
        providerMatch.odds.lastUpdated,
      );
      warnings.push(formatH2HWarning(providerMarket));
      warnings.push(`COLLECTED_AT=${providerMarket.collectedAt}`);
      warnings.push(`PROVIDER_MATCH=${providerMatch.method}`);
    }

    let openingOdds: number | null = null;
    let latestOdds: number | null = null;
    let marketProbability: number | null = null;

    if (providerMarket?.referenceOdds != null) {
      openingOdds = providerMarket.referenceOdds;
      latestOdds = providerMarket.referenceOdds;
      marketProbability = providerMarket.marketProbabilityPct;
    }

    const firstSnap = timeline?.snapshots[0] ?? null;
    const lastSnap =
      timeline && timeline.snapshots.length > 0
        ? timeline.snapshots[timeline.snapshots.length - 1]!
        : null;

    if (firstSnap?.pickOdds != null) {
      openingOdds = firstSnap.pickOdds;
    }
    if (lastSnap?.pickOdds != null) {
      latestOdds = lastSnap.pickOdds;
    }
    if (lastSnap?.marketProbability != null) {
      marketProbability = Math.round(lastSnap.marketProbability * 1000) / 10;
    }

    if (
      openingOdds == null &&
      target.predictionOpeningOdds != null &&
      !providerMatch
    ) {
      openingOdds = target.predictionOpeningOdds;
      warnings.push("PREDICTION_FALLBACK_OPENING");
    }
    if (
      latestOdds == null &&
      target.predictionLatestOdds != null &&
      !providerMatch
    ) {
      latestOdds = target.predictionLatestOdds;
      warnings.push("PREDICTION_FALLBACK_LATEST");
    }
    if (
      marketProbability == null &&
      target.predictionMarketProbability != null &&
      !providerMatch
    ) {
      marketProbability = target.predictionMarketProbability;
      warnings.push("PREDICTION_FALLBACK_MARKET_PROB");
    }

    if (openingOdds == null) missing.push("openingOdds");
    if (latestOdds == null) missing.push("latestOdds");
    if (marketProbability == null) missing.push("marketProbability");

    let joinQuality: OddsHistoryJoinQuality = "MISSING_ODDS";
    if (providerMatch && openingOdds != null && latestOdds != null) {
      joinQuality = "MATCHED";
    } else if (
      (openingOdds != null || latestOdds != null) &&
      (timeline?.snapshots.length ?? 0) > 0
    ) {
      joinQuality = "TIMELINE_ONLY";
    } else if (openingOdds != null || latestOdds != null) {
      joinQuality = "TIMELINE_ONLY";
      if (!providerMatch) {
        warnings.push("PREDICTION_ODDS_ONLY");
      }
    }

    if (!providerMatch) {
      warnings.push("NOT_COLLECTED_REASON=NO_PROVIDER_MATCH");
    } else if (providerMarket?.referenceOdds == null) {
      warnings.push("NOT_COLLECTED_REASON=PROVIDER_H2H_INCOMPLETE");
    }

    if (
      providerMatch &&
      openingOdds != null &&
      latestOdds != null &&
      openingOdds === latestOdds &&
      !firstSnap &&
      !lastSnap
    ) {
      warnings.push("OPENING_EQUALS_LATEST_SINGLE_SNAPSHOT");
    }

    if (openingOdds != null) openingCollected += 1;
    if (latestOdds != null) latestCollected += 1;
    if (marketProbability != null) marketProbabilityCollected += 1;

    const movement = computeMovement(openingOdds, latestOdds);
    movementCounts[movement] += 1;
    joinQualityCounts[joinQuality] += 1;

    const capturedAt =
      lastSnap?.capturedAt ??
      providerMarket?.collectedAt ??
      target.cutoffTime;
    if (!capturedAt) missing.push("capturedAt");
    if (!target.cutoffTime) missing.push("cutoffTime");

    const resolvedSportKey = oddsFetch.sportKey ?? timelineSportKey;
    const provider: OddsHistoryProviderSnapshot = resolvedSportKey
      ? {
          id: ODDS_HISTORY_PROVIDER_ID,
          displayName: "The Odds API",
          sportKey: resolvedSportKey,
        }
      : {
          id: "NOT_COLLECTED",
          displayName: "NOT_COLLECTED",
          sportKey: null,
        };

    if (provider.id === "NOT_COLLECTED") {
      missing.push("provider");
      warnings.push("ODDS_API_UNAVAILABLE");
    }

    const bookmaker =
      openingOdds != null || latestOdds != null
        ? ("AGGREGATE_BEST" as const)
        : null;

    if (
      timeline &&
      timeline.matchStatus === "ambiguous" &&
      timeline.snapshots.length === 0
    ) {
      warnings.push("TIMELINE_MATCH_AMBIGUOUS");
    }

    if (
      firstSnap &&
      openingOdds != null &&
      firstSnap.pickOdds != null &&
      Math.abs(firstSnap.pickOdds - openingOdds) > 0.05
    ) {
      warnings.push("OPENING_ODDS_TIMELINE_DIVERGENCE");
    }

    const rowInputHash = sha256(
      stableStringify({
        gameId: target.gameId,
        predictionHash,
        providerEventId: providerMarket?.oddsEventId ?? null,
        openingOdds,
        latestOdds,
        marketProbability,
        timelineFirstCapturedAt: firstSnap?.capturedAt ?? null,
        timelineLastCapturedAt: lastSnap?.capturedAt ?? null,
        sportKey: provider.sportKey,
      }),
    );

    const rowBody: Omit<OddsHistoryDatasetRow, "inputHash" | "resultHash"> = {
      schemaVersion: ODDS_HISTORY_SCHEMA_VERSION,
      builderVersion: ODDS_HISTORY_BUILDER_VERSION,
      generatedAt,
      gameDate: input.dateKst,
      gameId: target.gameId,
      homeTeam: target.homeTeam,
      awayTeam: target.awayTeam,
      baselinePick: target.baselinePick,
      collectionPhase: ODDS_HISTORY_COLLECTION_PHASE,
      cutoffTime: target.cutoffTime,
      researchOnly: true,
      legalStatus: "REFERENCE_ODDS_RESEARCH_ONLY",
      engineUseAllowed: false,
      joinQuality,
      openingOdds,
      latestOdds,
      marketProbability,
      provider,
      bookmaker,
      marketType: "h2h",
      movement,
      capturedAt,
      oddsEventId:
        providerMarket?.oddsEventId ??
        timeline?.oddsEventId ??
        lastSnap?.oddsEventId ??
        null,
      bookmakerCount:
        providerMarket?.bookmakerCount ??
        lastSnap?.bookmakerCount ??
        firstSnap?.bookmakerCount ??
        null,
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

  const inputHashSha256 = sha256(
    stableStringify({
      dateKst: input.dateKst,
      predictionHash,
      sportKey: oddsFetch.sportKey ?? timelineSportKey,
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
        "Schedule-first independent intake; primary odds from The Odds API h2h.",
        "Optional prediction snapshot enriches baselinePick / gap-fill only.",
        "movement is numeric decimal-odds delta only (UP/DOWN/UNCHANGED).",
        "Provider schema is swappable (future proto/other lawful sources).",
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
      movement: movementCounts,
      joinQuality: joinQualityCounts,
    },
    rows,
  };

  return { document, usage };
}
