/**
 * MLB Weather Dataset v1 builder — venue + forecast placeholder rows only.
 *
 * - PRE_GAME_FORECAST phase only
 * - Forecast fields NOT_COLLECTED (no provider selected)
 * - roofStatus always UNKNOWN — no open/closed inference
 * - No Engine / Score / Framework imports
 */
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "./research-stats-cache";
import {
  WEATHER_BUILDER_VERSION,
  WEATHER_COLLECTION_PHASE,
  WEATHER_DATASET_ID,
  WEATHER_PROVIDER_CANDIDATES,
  WEATHER_SCHEMA_VERSION,
  type BuildWeatherDatasetResult,
  type WeatherDatasetDocument,
  type WeatherDatasetRow,
  type WeatherFieldAvailability,
  type WeatherForecastSnapshot,
  type WeatherRoofType,
} from "./weather-dataset-types";

const NOT_COLLECTED: WeatherFieldAvailability = "NOT_COLLECTED";

const EMPTY_FORECAST: WeatherForecastSnapshot = {
  temperature: NOT_COLLECTED,
  humidity: NOT_COLLECTED,
  windSpeed: NOT_COLLECTED,
  windDirection: NOT_COLLECTED,
  precipProbability: NOT_COLLECTED,
  condition: NOT_COLLECTED,
};

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

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

type GameTarget = {
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  cutoffTime: string | null;
  startTimeKst: string | null;
};

async function loadGameTargets(dateKst: string): Promise<GameTarget[]> {
  const starterPath = path.join(
    process.cwd(),
    "data/research/mlb",
    `${dateKst}-starter-dataset-v1.json`,
  );
  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${dateKst}.json`,
  );

  if (!(await fileExists(predPath))) {
    throw new Error(`prediction snapshot missing: ${predPath}`);
  }
  if (!(await fileExists(starterPath))) {
    throw new Error(
      `starter dataset missing (read-only join for gamePk): ${starterPath}`,
    );
  }

  const pred = JSON.parse(await readFile(predPath, "utf8")) as {
    predictions?: unknown[];
  };
  const starter = JSON.parse(await readFile(starterPath, "utf8")) as {
    rows?: unknown[];
  };

  const predByGameId = new Map<
    string,
    { homeTeam: string; awayTeam: string; startTimeKst: string | null }
  >();
  for (const raw of pred.predictions ?? []) {
    const p = asRecord(raw);
    if (!p) continue;
    const gameId = asString(p.gameId);
    if (!gameId) continue;
    predByGameId.set(gameId, {
      homeTeam: asString(p.homeTeam) ?? "",
      awayTeam: asString(p.awayTeam) ?? "",
      startTimeKst: asString(p.startTimeKst),
    });
  }

  const byGamePk = new Map<number, GameTarget>();
  for (const raw of starter.rows ?? []) {
    const r = asRecord(raw);
    if (!r) continue;
    if (asString(r.side) !== "home") continue;
    const gameId = asString(r.gameId);
    const gamePk = asNumber(r.gamePk);
    if (!gameId || gamePk == null) continue;
    const meta = predByGameId.get(gameId);
    byGamePk.set(gamePk, {
      gameId,
      gamePk,
      homeTeam: meta?.homeTeam ?? asString(r.homeTeam) ?? "",
      awayTeam: meta?.awayTeam ?? asString(r.awayTeam) ?? "",
      cutoffTime: asString(r.cutoffTime),
      startTimeKst: meta?.startTimeKst ?? null,
    });
  }

  return [...byGamePk.values()].sort((a, b) => a.gamePk - b.gamePk);
}

type ScheduleVenueRef = {
  venueId: number;
  venueName: string;
};

async function loadScheduleVenueForGame(
  gamePk: number,
  usage: CacheUsageStats,
): Promise<ScheduleVenueRef | null> {
  const body = asRecord(
    await getRawStatsJson(
      `/api/v1/schedule?sportId=1&gamePk=${gamePk}`,
      usage,
    ),
  );
  for (const day of Array.isArray(body?.dates) ? body!.dates : []) {
    const games = Array.isArray(asRecord(day)?.games)
      ? (asRecord(day)!.games as unknown[])
      : [];
    for (const raw of games) {
      const g = asRecord(raw);
      if (!g || asNumber(g.gamePk) !== gamePk) continue;
      const venue = asRecord(g.venue);
      const venueId = asNumber(venue?.id);
      const venueName = asString(venue?.name);
      if (venueId == null || !venueName) return null;
      return { venueId, venueName };
    }
  }
  return null;
}

async function loadScheduleVenueMap(
  dateKst: string,
  gamePks: number[],
  usage: CacheUsageStats,
): Promise<Map<number, ScheduleVenueRef>> {
  const body = asRecord(
    await getRawStatsJson(
      `/api/v1/schedule?sportId=1&date=${dateKst}`,
      usage,
    ),
  );
  const map = new Map<number, ScheduleVenueRef>();
  for (const day of Array.isArray(body?.dates) ? body!.dates : []) {
    const games = Array.isArray(asRecord(day)?.games)
      ? (asRecord(day)!.games as unknown[])
      : [];
    for (const raw of games) {
      const g = asRecord(raw);
      if (!g) continue;
      const gamePk = asNumber(g.gamePk);
      const venue = asRecord(g.venue);
      const venueId = asNumber(venue?.id);
      const venueName = asString(venue?.name);
      if (gamePk == null || venueId == null || !venueName) continue;
      map.set(gamePk, { venueId, venueName });
    }
  }

  for (const gamePk of gamePks) {
    if (map.has(gamePk)) continue;
    const ref = await loadScheduleVenueForGame(gamePk, usage);
    if (ref) map.set(gamePk, ref);
  }

  return map;
}

function normalizeRoofType(raw: string | null): WeatherRoofType | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "open") return "OPEN";
  if (v === "dome") return "DOME";
  if (v === "retractable") return "RETRACTABLE";
  return null;
}

async function loadVenueRoofType(
  venueId: number,
  usage: CacheUsageStats,
): Promise<WeatherRoofType | null> {
  const body = asRecord(
    await getRawStatsJson(
      `/api/v1/venues/${venueId}?hydrate=location,fieldInfo`,
      usage,
    ),
  );
  const venues = Array.isArray(body?.venues) ? body!.venues : [];
  const venue = asRecord(venues[0]);
  const fieldInfo = asRecord(venue?.fieldInfo);
  return normalizeRoofType(asString(fieldInfo?.roofType));
}

function hashableRowBody(row: WeatherDatasetRow): Record<string, unknown> {
  return {
    gameId: row.gameId,
    gamePk: row.gamePk,
    gameDate: row.gameDate,
    collectionPhase: row.collectionPhase,
    venue: row.venue,
    forecast: row.forecast,
    forecastIssuedAt: row.forecastIssuedAt,
    cutoffTime: row.cutoffTime,
    missing: row.missing,
    warnings: row.warnings,
  };
}

export function assertWeatherDatasetIntegrity(
  document: WeatherDatasetDocument,
): string[] {
  const issues: string[] = [];
  if (document.meta.engineAdmission !== "PROHIBITED") {
    issues.push("engineAdmission must be PROHIBITED");
  }
  if (document.meta.provider.selected !== null) {
    issues.push("provider must not be auto-selected");
  }
  for (const row of document.rows) {
    if (row.collectionPhase !== WEATHER_COLLECTION_PHASE) {
      issues.push(`${row.gameId}: invalid collectionPhase`);
    }
    if (row.venue.roofStatus !== "UNKNOWN") {
      issues.push(`${row.gameId}: roofStatus must be UNKNOWN`);
    }
    if (row.forecastIssuedAt !== null) {
      issues.push(`${row.gameId}: forecastIssuedAt must be null in v1`);
    }
    for (const [key, val] of Object.entries(row.forecast)) {
      if (val !== NOT_COLLECTED) {
        issues.push(`${row.gameId}: forecast.${key} must be NOT_COLLECTED`);
      }
    }
  }
  return issues;
}

export async function buildWeatherDatasetV1(input: {
  dateKst: string;
  predictionRaw: string;
}): Promise<BuildWeatherDatasetResult> {
  const predictionHash = sha256(input.predictionRaw);
  const usage = createCacheUsage();
  const targets = await loadGameTargets(input.dateKst);
  const scheduleVenues = await loadScheduleVenueMap(
    input.dateKst,
    targets.map((g) => g.gamePk),
    usage,
  );
  const generatedAt = new Date().toISOString();
  const rows: WeatherDatasetRow[] = [];

  const roofTypeCounts: Record<string, number> = {
    OPEN: 0,
    DOME: 0,
    RETRACTABLE: 0,
    UNKNOWN: 0,
  };

  for (const game of targets) {
    const missing: string[] = [];
    const warnings: string[] = [];
    const sched = scheduleVenues.get(game.gamePk);

    if (!sched) {
      missing.push("venueId", "venueName");
      warnings.push("SCHEDULE_VENUE_NOT_FOUND");
    }

    let roofType: WeatherRoofType | null = null;
    if (sched) {
      roofType = await loadVenueRoofType(sched.venueId, usage);
      if (!roofType) {
        missing.push("roofType");
        warnings.push("ROOF_TYPE_UNAVAILABLE");
        roofTypeCounts.UNKNOWN += 1;
      } else {
        roofTypeCounts[roofType] += 1;
      }
    } else {
      roofTypeCounts.UNKNOWN += 1;
    }

    if (!game.cutoffTime) {
      missing.push("cutoffTime");
    }

    const rowInputHash = sha256(
      stableStringify({
        gameId: game.gameId,
        gamePk: game.gamePk,
        venueId: sched?.venueId ?? null,
        predictionHash,
        provider: null,
      }),
    );

    const venue = {
      id: sched?.venueId ?? 0,
      name: sched?.venueName ?? "",
      roofType,
      roofStatus: "UNKNOWN" as const,
    };

    const rowBody: Omit<WeatherDatasetRow, "inputHash" | "resultHash"> = {
      schemaVersion: WEATHER_SCHEMA_VERSION,
      builderVersion: WEATHER_BUILDER_VERSION,
      generatedAt,
      gameDate: input.dateKst,
      gameId: game.gameId,
      gamePk: game.gamePk,
      collectionPhase: WEATHER_COLLECTION_PHASE,
      venue,
      forecast: { ...EMPTY_FORECAST },
      forecastIssuedAt: null,
      cutoffTime: game.cutoffTime,
      researchOnly: true,
      legalStatus: "INTERNAL_RESEARCH_ONLY",
      engineUseAllowed: false,
      missing,
      warnings,
    };

    const resultHash = sha256(stableStringify(hashableRowBody(rowBody as WeatherDatasetRow)));

    rows.push({
      ...rowBody,
      inputHash: rowInputHash,
      resultHash,
    });
  }

  const hashableRows = rows.map((r) => hashableRowBody(r));
  const inputHashSha256 = sha256(
    stableStringify({
      datasetId: WEATHER_DATASET_ID,
      schemaVersion: WEATHER_SCHEMA_VERSION,
      builderVersion: WEATHER_BUILDER_VERSION,
      dateKst: input.dateKst,
      predictionHash,
      providerSelected: null,
      games: targets.map((g) => ({ gameId: g.gameId, gamePk: g.gamePk })),
    }),
  );
  const resultHashSha256 = sha256(stableStringify(hashableRows));

  const venuesResolved = rows.filter((r) => r.venue.id > 0).length;

  const document: WeatherDatasetDocument = {
    meta: {
      datasetId: WEATHER_DATASET_ID,
      schemaVersion: WEATHER_SCHEMA_VERSION,
      builderVersion: WEATHER_BUILDER_VERSION,
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
      provider: {
        selected: null,
        candidates: [...WEATHER_PROVIDER_CANDIDATES],
        status: "NOT_SELECTED",
      },
      legal: {
        mlbStatsSource: "INTERNAL_RESEARCH_ONLY",
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
        mlbHtmlCrawling: false,
        sportsDataIoScrambled: false,
        weatherProviderScraping: false,
      },
      notes: [
        "PRE_GAME_FORECAST only — POST_GAME_OBSERVED not implemented",
        "Forecast provider NOT_SELECTED — all forecast fields NOT_COLLECTED",
        "roofStatus=UNKNOWN only — no open/closed inference",
        "Environment dataset v1 — reproducible venue snapshot at cutoff",
        "Engine admission PROHIBITED",
      ],
    },
    cacheUsage: { ...usage },
    summary: {
      totalGames: targets.length,
      venuesResolved,
      roofTypes: roofTypeCounts,
      forecastCollected: 0,
      forecastMissing: targets.length,
      weatherCollected: 0,
      weatherMissing: targets.length,
    },
    rows,
  };

  return { document, usage };
}
