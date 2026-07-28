/**
 * TheSportsDB KBO Schedule Provider adapter.
 *
 * All TheSportsDB-specific logic lives here:
 * - leagueId 4830
 * - eventsday.php endpoint
 * - free tier 3-game limit warning
 * - raw event field parsing and status mapping
 */
import { createHash } from "node:crypto";
import { instantToKst } from "../../datetime/kst";
import { KboIdentityCollectionError } from "../kbo-identity-errors";
import {
  createKboCacheUsage,
  type KboCacheUsageStats,
} from "../kbo-cache-types";
import { getKboTheSportsDbJson } from "../kbo-thesportsdb-cache";
import type { KboGameStatus } from "../schedule-result-identity-types";
import type {
  KboNormalizedScheduleGame,
  KboScheduleFetchResult,
  KboScheduleProvider,
  KboScheduleProviderMetadata,
} from "./kbo-schedule-provider";

export const THESPORTSDB_KBO_LEAGUE_ID = "4830";
const THESPORTSDB_FREE_EVENTS_DAY_LIMIT = 3;

type TheSportsDbEvent = {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strSeason?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  strVenue?: string;
  strStatus?: string;
  strPostponed?: string;
  intHomeScore?: string | number | null;
  intAwayScore?: string | number | null;
  idLeague?: string;
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
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

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function parseScore(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function resolveProviderStartTime(event: TheSportsDbEvent): string | null {
  if (event.strTimestamp) {
    const ts = event.strTimestamp.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(ts)) {
      return ts.endsWith("Z") ? ts : `${ts}Z`;
    }
  }
  const date = asString(event.dateEvent);
  const time = asString(event.strTime);
  if (date && time && /^\d{2}:\d{2}/.test(time)) {
    const normalized = time.length === 5 ? `${time}:00` : time.slice(0, 8);
    return `${date}T${normalized}Z`;
  }
  return null;
}

function resolveStartTimeKst(providerStartTime: string | null): string | null {
  if (!providerStartTime) return null;
  const kst = instantToKst(providerStartTime);
  if (!kst) return null;
  if (kst.time === "TBD") return `${kst.date}T00:00:00+09:00`;
  return `${kst.date}T${kst.time}:00+09:00`;
}

function mapTheSportsDbGameStatus(
  providerStatusRaw: string | null,
  postponedFlag: string | null,
): KboGameStatus {
  const raw = (providerStatusRaw ?? "").trim().toUpperCase();
  const postponed = (postponedFlag ?? "").trim().toLowerCase() === "yes";

  if (postponed || raw === "POST" || raw === "PST" || raw === "POSTPONED") {
    return "POSTPONED";
  }
  if (raw === "CANC" || raw === "CANCELLED") return "CANCELLED";
  if (raw === "NS" || raw === "TBD" || raw === "NOT STARTED") return "SCHEDULED";
  if (raw === "FT" || raw === "FINISHED" || raw === "FULL TIME") return "FINAL";
  if (raw === "DRAW") return "DRAW";
  if (raw === "ABD" || raw === "ABANDONED") return "SUSPENDED";
  if (raw === "SUSP" || raw === "SUSPENDED") return "SUSPENDED";
  if (raw === "NG" || raw === "NO GAME") return "NO_GAME";
  if (
    raw === "LIVE" ||
    raw === "1H" ||
    raw === "2H" ||
    raw === "IN PLAY" ||
    /^\d/.test(raw)
  ) {
    return "LIVE";
  }
  if (raw === "") return "UNKNOWN";
  return "UNKNOWN";
}

function payloadHashSlice(event: TheSportsDbEvent): string {
  return sha256(
    stableStringify({
      idEvent: event.idEvent ?? null,
      strStatus: event.strStatus ?? null,
      strPostponed: event.strPostponed ?? null,
      strTimestamp: event.strTimestamp ?? null,
      dateEvent: event.dateEvent ?? null,
      strTime: event.strTime ?? null,
      strHomeTeam: event.strHomeTeam ?? null,
      strAwayTeam: event.strAwayTeam ?? null,
      idHomeTeam: event.idHomeTeam ?? null,
      idAwayTeam: event.idAwayTeam ?? null,
      strVenue: event.strVenue ?? null,
      strSeason: event.strSeason ?? null,
      intHomeScore: event.intHomeScore ?? null,
      intAwayScore: event.intAwayScore ?? null,
      idLeague: event.idLeague ?? null,
    }),
  );
}

function normalizeTheSportsDbEvent(
  event: TheSportsDbEvent,
): KboNormalizedScheduleGame | null {
  const providerGameId = asString(event.idEvent);
  const homeTeamProviderName = asString(event.strHomeTeam);
  const awayTeamProviderName = asString(event.strAwayTeam);
  if (!providerGameId || !homeTeamProviderName || !awayTeamProviderName) {
    return null;
  }
  if (event.idLeague && event.idLeague !== THESPORTSDB_KBO_LEAGUE_ID) {
    return null;
  }

  const providerStartTime = resolveProviderStartTime(event);
  const providerStatusRaw = asString(event.strStatus);

  return {
    providerGameId,
    providerStatusRaw,
    providerStartTime,
    startTimeKst: resolveStartTimeKst(providerStartTime),
    season: asString(event.strSeason),
    homeTeamProviderId: asString(event.idHomeTeam),
    homeTeamProviderName,
    awayTeamProviderId: asString(event.idAwayTeam),
    awayTeamProviderName,
    venueName: asString(event.strVenue),
    homeScore: parseScore(event.intHomeScore),
    awayScore: parseScore(event.intAwayScore),
    gameStatus: mapTheSportsDbGameStatus(
      providerStatusRaw,
      asString(event.strPostponed),
    ),
    providerPayloadHash: payloadHashSlice(event),
  };
}

export type TheSportsDbKboScheduleProviderOptions = {
  baseUrl?: string;
  apiKey?: string;
  cwd?: string;
};

export class TheSportsDbKboScheduleProvider implements KboScheduleProvider {
  readonly usage: KboCacheUsageStats;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly cwd?: string;

  constructor(options: TheSportsDbKboScheduleProviderOptions = {}) {
    this.usage = createKboCacheUsage();
    this.baseUrl =
      options.baseUrl?.trim() ||
      process.env.SPORTS_API_BASE_URL?.trim() ||
      "https://www.thesportsdb.com/api/v1/json";
    this.apiKey =
      options.apiKey?.trim() || process.env.SPORTS_API_KEY?.trim() || "";
    this.cwd = options.cwd;
  }

  getProviderMetadata(): KboScheduleProviderMetadata {
    return {
      id: "THESPORTSDB",
      leagueId: THESPORTSDB_KBO_LEAGUE_ID,
      legalStatus: "INTERNAL_RESEARCH_ONLY",
      researchUse: "INTERNAL_RESEARCH_ONLY",
      publicDisplay: "UNCONFIRMED",
      commercialUse: "UNCONFIRMED",
    };
  }

  async fetchGamesByDate(dateKst: string): Promise<KboScheduleFetchResult> {
    if (!this.apiKey) {
      throw new KboIdentityCollectionError(
        "PROVIDER_REQUEST_FAILED",
        "SPORTS_API_KEY is not configured",
      );
    }

    const endpoint = `eventsday.php?d=${encodeURIComponent(dateKst)}&l=${THESPORTSDB_KBO_LEAGUE_ID}`;

    let response: unknown;
    try {
      response = await getKboTheSportsDbJson(
        endpoint,
        this.usage,
        { baseUrl: this.baseUrl, apiKey: this.apiKey },
        this.cwd,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Provider request failed";
      if (message.toLowerCase().includes("cache")) {
        throw new KboIdentityCollectionError("CACHE_READ_FAILED", message);
      }
      throw new KboIdentityCollectionError(
        "PROVIDER_REQUEST_FAILED",
        message,
      );
    }

    const events = Array.isArray(
      (response as { events?: TheSportsDbEvent[] | null }).events,
    )
      ? ((response as { events: TheSportsDbEvent[] }).events ?? [])
      : [];

    const warnings: string[] = [];
    const missing: string[] = [];
    const games: KboNormalizedScheduleGame[] = [];

    if (events.length >= THESPORTSDB_FREE_EVENTS_DAY_LIMIT) {
      warnings.push(
        `PROVIDER_LIMITED_COVERAGE: TheSportsDB free tier may return at most ${THESPORTSDB_FREE_EVENTS_DAY_LIMIT} events per league per request; fetched=${events.length}`,
      );
    }

    for (const event of events) {
      const normalized = normalizeTheSportsDbEvent(event);
      if (!normalized) {
        if (!asString(event.idEvent)) {
          missing.push("PROVIDER_GAME_ID_MISSING");
        } else if (
          !asString(event.strHomeTeam) ||
          !asString(event.strAwayTeam)
        ) {
          missing.push(`TEAM_NAMES_MISSING:${asString(event.idEvent)}`);
        } else {
          missing.push(`LEAGUE_MISMATCH:${asString(event.idEvent)}`);
        }
        continue;
      }
      games.push(normalized);
    }

    games.sort((a, b) => a.providerGameId.localeCompare(b.providerGameId));

    return {
      games,
      metadata: this.getProviderMetadata(),
      warnings,
      missing,
      rawGameCount: events.length,
    };
  }
}

export function createTheSportsDbKboScheduleProvider(
  options?: TheSportsDbKboScheduleProviderOptions,
): TheSportsDbKboScheduleProvider {
  return new TheSportsDbKboScheduleProvider(options);
}
