/**
 * MLB Stats API 연구용 raw / derived disk cache.
 *
 * source = INTERNAL_RESEARCH_ONLY
 * 공개·상업 런타임 연결 금지.
 * API 키 저장 금지.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BULLPEN_CLASSIFIER_VERSION,
  BULLPEN_SCHEMA_VERSION,
  MLB_STATS_SOURCE_LABEL,
} from "./bullpen-role-constants";
import type { DerivedCacheMeta } from "./bullpen-role-types";

const STATS_API_BASE = "https://statsapi.mlb.com";

export type CacheUsageStats = {
  rawHit: number;
  rawMiss: number;
  derivedHit: number;
  derivedMiss: number;
  networkCalls: number;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function createCacheUsage(): CacheUsageStats {
  return {
    rawHit: 0,
    rawMiss: 0,
    derivedHit: 0,
    derivedMiss: 0,
    networkCalls: 0,
  };
}

export function researchCacheRoot(cwd = process.cwd()): string {
  return path.join(cwd, "data", "cache", "research", "mlb");
}

function rawPath(relKey: string, cwd?: string): string {
  const safe = relKey.replace(/[^a-zA-Z0-9._\-/]/g, "_");
  return path.join(researchCacheRoot(cwd), "raw", "statsapi", `${safe}.json`);
}

function derivedPath(name: string, cwd?: string): string {
  return path.join(researchCacheRoot(cwd), "derived", "bullpen", name);
}

function domainDerivedPath(
  domain: "bullpen" | "starter",
  name: string,
  cwd?: string,
): string {
  return path.join(researchCacheRoot(cwd), "derived", domain, name);
}

export type GetRawStatsJsonOptions = {
  cwd?: string;
  /** When true: skip disk read, always hit StatsAPI, overwrite raw cache. */
  forceRefresh?: boolean;
  /** When true: never network; throw if disk cache is missing. */
  cacheOnly?: boolean;
};

function resolveGetRawStatsOptions(
  cwdOrOptions?: string | GetRawStatsJsonOptions,
): GetRawStatsJsonOptions {
  if (typeof cwdOrOptions === "string") return { cwd: cwdOrOptions };
  return cwdOrOptions ?? {};
}

/**
 * Raw StatsAPI cache helper.
 * Default: reuse disk cache (Starter / Bullpen / Schedule Builder).
 * Official Result must pass `{ forceRefresh: true }` so pre-pitch
 * schedule snapshots cannot freeze status as NOT_FINAL forever.
 * MLB pregame lineup refresh must NOT use forceRefresh here: it would
 * overwrite raw evidence. Late confirmed lineups are stored append-only
 * under data/research/mlb/lineup-refresh/{date}/raw/.
 */
export async function getRawStatsJson(
  pathQuery: string,
  usage: CacheUsageStats,
  cwdOrOptions?: string | GetRawStatsJsonOptions,
): Promise<unknown> {
  const { cwd, forceRefresh = false, cacheOnly = false } = resolveGetRawStatsOptions(
    cwdOrOptions,
  );
  const key = pathQuery.replace(/^\//, "").replace(/[?&=]/g, "_");
  const file = rawPath(key, cwd);

  if (!forceRefresh) {
    try {
      const raw = await readFile(file, "utf8");
      usage.rawHit += 1;
      const parsed = JSON.parse(raw) as { body?: unknown };
      return parsed.body ?? parsed;
    } catch {
      if (cacheOnly) {
        usage.rawMiss += 1;
        throw new Error(`CACHE_ONLY_MISS ${pathQuery}`);
      }
      // miss → network
    }
  }

  if (cacheOnly) {
    usage.rawMiss += 1;
    throw new Error(`CACHE_ONLY_MISS ${pathQuery}`);
  }

  usage.rawMiss += 1;
  usage.networkCalls += 1;
  const res = await fetch(`${STATS_API_BASE}${pathQuery}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`StatsAPI ${res.status} ${pathQuery}`);
  }
  const body = await res.json();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify(
      {
        meta: {
          source: MLB_STATS_SOURCE_LABEL,
          pathQuery,
          fetchedAt: new Date().toISOString(),
          publicRuntimeUseAllowed: false,
          commercialRuntimeUseAllowed: false,
          forceRefresh,
        },
        body,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return body;
}

export async function readDerivedJson<T>(
  fileName: string,
  usage: CacheUsageStats,
  cwd?: string,
): Promise<{ meta: DerivedCacheMeta; data: T } | null> {
  const file = derivedPath(fileName, cwd);
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as {
      meta?: DerivedCacheMeta;
      data?: T;
    };
    if (!parsed.meta || parsed.data === undefined) {
      usage.derivedMiss += 1;
      return null;
    }
    if (parsed.meta.classifierVersion !== BULLPEN_CLASSIFIER_VERSION) {
      usage.derivedMiss += 1;
      return null;
    }
    usage.derivedHit += 1;
    return { meta: parsed.meta, data: parsed.data };
  } catch {
    usage.derivedMiss += 1;
    return null;
  }
}

export async function writeDerivedJson<T>(
  fileName: string,
  data: T,
  opts: {
    dataThroughDate: string;
    inputHash: string;
    recordCount: number;
  },
  cwd?: string,
): Promise<DerivedCacheMeta> {
  const meta: DerivedCacheMeta = {
    schemaVersion: BULLPEN_SCHEMA_VERSION,
    classifierVersion: BULLPEN_CLASSIFIER_VERSION,
    generatedAt: new Date().toISOString(),
    dataThroughDate: opts.dataThroughDate,
    source: MLB_STATS_SOURCE_LABEL,
    inputHash: opts.inputHash,
    recordCount: opts.recordCount,
  };
  const file = derivedPath(fileName, cwd);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify({ meta, data }, null, 2)}\n`,
    "utf8",
  );
  return meta;
}

/** Starter dataset derived cache (separate from bullpen classifier version gate). */
export async function readStarterDerivedJson<T>(
  fileName: string,
  expectedBuilderVersion: string,
  usage: CacheUsageStats,
  cwd?: string,
): Promise<{ meta: Record<string, unknown>; data: T } | null> {
  const file = domainDerivedPath("starter", fileName, cwd);
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as {
      meta?: Record<string, unknown>;
      data?: T;
    };
    if (!parsed.meta || parsed.data === undefined) {
      usage.derivedMiss += 1;
      return null;
    }
    if (parsed.meta.builderVersion !== expectedBuilderVersion) {
      usage.derivedMiss += 1;
      return null;
    }
    usage.derivedHit += 1;
    return { meta: parsed.meta, data: parsed.data };
  } catch {
    usage.derivedMiss += 1;
    return null;
  }
}

export async function writeStarterDerivedJson<T>(
  fileName: string,
  data: T,
  opts: {
    schemaVersion: string;
    builderVersion: string;
    dataThroughDate: string;
    inputHash: string;
    recordCount: number;
  },
  cwd?: string,
): Promise<Record<string, unknown>> {
  const meta = {
    schemaVersion: opts.schemaVersion,
    builderVersion: opts.builderVersion,
    generatedAt: new Date().toISOString(),
    dataThroughDate: opts.dataThroughDate,
    source: MLB_STATS_SOURCE_LABEL,
    inputHash: opts.inputHash,
    recordCount: opts.recordCount,
  };
  const file = domainDerivedPath("starter", fileName, cwd);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify({ meta, data }, null, 2)}\n`,
    "utf8",
  );
  return meta;
}

export function hashInput(parts: unknown[]): string {
  return sha256(stableStringify(parts));
}

export function hashResult(value: unknown): string {
  return sha256(stableStringify(value));
}

export function extractScheduleGames(data: unknown): Array<{
  gamePk: number;
  gameDate: string;
  officialDate: string;
  status: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
}> {
  const root = asRecord(data);
  const dates = Array.isArray(root?.dates) ? root!.dates : [];
  const out: Array<{
    gamePk: number;
    gameDate: string;
    officialDate: string;
    status: string;
    homeTeamId: number;
    awayTeamId: number;
    homeTeam: string;
    awayTeam: string;
  }> = [];
  for (const day of dates) {
    const games = Array.isArray(asRecord(day)?.games)
      ? (asRecord(day)!.games as unknown[])
      : [];
    for (const raw of games) {
      const row = asRecord(raw);
      if (!row) continue;
      const gamePk =
        typeof row.gamePk === "number" ? row.gamePk : null;
      const gameDate =
        typeof row.gameDate === "string" ? row.gameDate : null;
      const officialDate =
        typeof row.officialDate === "string" ? row.officialDate : null;
      const status =
        typeof asRecord(row.status)?.abstractGameState === "string"
          ? (asRecord(row.status)!.abstractGameState as string)
          : "";
      const teams = asRecord(row.teams);
      const home = asRecord(teams?.home);
      const away = asRecord(teams?.away);
      const homeTeamId =
        typeof asRecord(home?.team)?.id === "number"
          ? (asRecord(home?.team)!.id as number)
          : null;
      const awayTeamId =
        typeof asRecord(away?.team)?.id === "number"
          ? (asRecord(away?.team)!.id as number)
          : null;
      const homeTeam =
        typeof asRecord(home?.team)?.name === "string"
          ? (asRecord(home?.team)!.name as string)
          : null;
      const awayTeam =
        typeof asRecord(away?.team)?.name === "string"
          ? (asRecord(away?.team)!.name as string)
          : null;
      if (
        gamePk == null ||
        !gameDate ||
        !officialDate ||
        homeTeamId == null ||
        awayTeamId == null ||
        !homeTeam ||
        !awayTeam
      ) {
        continue;
      }
      out.push({
        gamePk,
        gameDate,
        officialDate,
        status,
        homeTeamId,
        awayTeamId,
        homeTeam,
        awayTeam,
      });
    }
  }
  return out;
}
