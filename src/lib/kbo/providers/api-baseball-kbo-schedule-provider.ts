import { createHash } from "node:crypto";
import { instantToKst } from "../../datetime/kst";
import { KboIdentityCollectionError } from "../kbo-identity-errors";
import {
  createKboCacheUsage,
  type KboCacheUsageStats,
} from "../kbo-api-baseball-cache";
import { getKboApiBaseballJson } from "../kbo-api-baseball-cache";
import type { KboGameStatus } from "../schedule-result-identity-types";
import type {
  KboNormalizedScheduleGame,
  KboScheduleFetchResult,
  KboScheduleProvider,
  KboScheduleProviderMetadata,
} from "./kbo-schedule-provider";

export const API_BASEBALL_KBO_LEAGUE_ID = "5";

type ApiBaseballGame = {
  id?: number;
  date?: string;
  time?: string;
  status?: { short?: string; long?: string };
  league?: { id?: number; name?: string; season?: number };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
  scores?: {
    home?: { total?: number | null };
    away?: { total?: number | null };
  };
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
  return out;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumberString(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : null;
}

function parseScore(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function mapApiBaseballStatus(rawStatus: string | null): KboGameStatus {
  const raw = (rawStatus ?? "").trim().toUpperCase();
  if (raw === "NS" || raw === "TBD" || raw === "SCHEDULED") return "SCHEDULED";
  if (
    raw === "LIVE" ||
    raw === "IN_PLAY" ||
    raw === "SUSP" ||
    raw === "INT" ||
    /^\d/.test(raw)
  ) {
    return "LIVE";
  }
  if (raw === "FT" || raw === "AOT" || raw === "FINAL") return "FINAL";
  if (raw === "POSTP" || raw === "POSTPONED") return "POSTPONED";
  if (raw === "CANC" || raw === "CANCELLED") return "CANCELLED";
  if (raw === "SUSPENDED") return "SUSPENDED";
  return "UNKNOWN";
}

function resolveStartTimeKst(providerStartTime: string | null): string | null {
  if (!providerStartTime) return null;
  const kst = instantToKst(providerStartTime);
  if (!kst) return null;
  return `${kst.date}T${kst.time}:00+09:00`;
}

function payloadHashSlice(game: ApiBaseballGame): string {
  return sha256(
    stableStringify({
      id: game.id ?? null,
      date: game.date ?? null,
      status: game.status?.short ?? null,
      leagueId: game.league?.id ?? null,
      season: game.league?.season ?? null,
      homeId: game.teams?.home?.id ?? null,
      awayId: game.teams?.away?.id ?? null,
      home: game.teams?.home?.name ?? null,
      away: game.teams?.away?.name ?? null,
      homeScore: game.scores?.home?.total ?? null,
      awayScore: game.scores?.away?.total ?? null,
    }),
  );
}

function normalizeApiBaseballGame(game: ApiBaseballGame): KboNormalizedScheduleGame | null {
  const providerGameId = asNumberString(game.id);
  const homeName = asString(game.teams?.home?.name);
  const awayName = asString(game.teams?.away?.name);
  const providerStartTime = asString(game.date);
  if (!providerGameId || !homeName || !awayName || !providerStartTime) {
    return null;
  }
  return {
    providerGameId,
    providerStatusRaw: asString(game.status?.short),
    providerStartTime,
    startTimeKst: resolveStartTimeKst(providerStartTime),
    season:
      typeof game.league?.season === "number"
        ? String(game.league?.season)
        : null,
    homeTeamProviderId: asNumberString(game.teams?.home?.id),
    homeTeamProviderName: homeName,
    awayTeamProviderId: asNumberString(game.teams?.away?.id),
    awayTeamProviderName: awayName,
    venueName: null,
    homeScore: parseScore(game.scores?.home?.total),
    awayScore: parseScore(game.scores?.away?.total),
    gameStatus: mapApiBaseballStatus(asString(game.status?.short)),
    providerPayloadHash: payloadHashSlice(game),
  };
}

export type ApiBaseballKboScheduleProviderOptions = {
  baseUrl?: string;
  apiKey?: string;
  cwd?: string;
};

export class ApiBaseballKboScheduleProvider implements KboScheduleProvider {
  readonly usage: KboCacheUsageStats;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly cwd?: string;

  constructor(options: ApiBaseballKboScheduleProviderOptions = {}) {
    this.usage = createKboCacheUsage();
    this.baseUrl =
      options.baseUrl?.trim() ||
      process.env.BASEBALL_API_BASE_URL?.trim() ||
      "https://v1.baseball.api-sports.io";
    this.apiKey =
      options.apiKey?.trim() ||
      process.env.BASEBALL_API_KEY?.trim() ||
      process.env.FOOTBALL_API_KEY?.trim() ||
      "";
    this.cwd = options.cwd;
  }

  getProviderMetadata(): KboScheduleProviderMetadata {
    return {
      id: "API_BASEBALL",
      leagueId: API_BASEBALL_KBO_LEAGUE_ID,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      researchUse: "INTERNAL_RESEARCH_ONLY",
      publicDisplay: "UNCONFIRMED",
      commercialUse: "UNCONFIRMED",
    };
  }

  async fetchGamesByDate(dateKst: string): Promise<KboScheduleFetchResult> {
    if (!this.apiKey) {
      throw new KboIdentityCollectionError(
        "PROVIDER_REQUEST_FAILED",
        "BASEBALL_API_KEY or FOOTBALL_API_KEY is not configured",
      );
    }

    const season = Number(dateKst.slice(0, 4));
    const endpoint = `games?league=${API_BASEBALL_KBO_LEAGUE_ID}&season=${season}`;
    let response: unknown;
    try {
      response = await getKboApiBaseballJson(
        endpoint,
        this.usage,
        { baseUrl: this.baseUrl, apiKey: this.apiKey },
        this.cwd,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Provider request failed";
      throw new KboIdentityCollectionError("PROVIDER_REQUEST_FAILED", message);
    }

    const gamesRaw = Array.isArray(
      (response as { response?: ApiBaseballGame[] | null }).response,
    )
      ? ((response as { response: ApiBaseballGame[] }).response ?? [])
      : [];

    const warnings: string[] = [];
    const missing: string[] = [];
    const games: KboNormalizedScheduleGame[] = [];

    for (const game of gamesRaw) {
      const normalized = normalizeApiBaseballGame(game);
      if (!normalized) {
        missing.push("PROVIDER_GAME_ID_OR_TEAM_MISSING");
        continue;
      }
      if (!normalized.startTimeKst?.startsWith(dateKst)) continue;
      games.push(normalized);
    }

    games.sort((a, b) => a.providerGameId.localeCompare(b.providerGameId));

    return {
      games,
      metadata: this.getProviderMetadata(),
      warnings,
      missing,
      rawGameCount: games.length,
    };
  }
}

export function createApiBaseballKboScheduleProvider(
  options?: ApiBaseballKboScheduleProviderOptions,
): ApiBaseballKboScheduleProvider {
  return new ApiBaseballKboScheduleProvider(options);
}
