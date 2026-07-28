import { instantToKst } from "../../datetime/kst";
import { KboIdentityCollectionError } from "../kbo-identity-errors";
import {
  createKboCacheUsage,
  getKboTheOddsApiJson,
  type KboCacheUsageStats,
} from "../kbo-the-odds-api-cache";
import { resolveKboTeamIdentity } from "../resolve-kbo-team-identity";
import type {
  KboNormalizedOverseasOddsGame,
  KboOverseasOddsFetchResult,
  KboOverseasOddsProvider,
} from "./kbo-overseas-odds-provider";

type RawSport = {
  key?: string;
  group?: string;
  title?: string;
  description?: string;
  active?: boolean;
  has_outrights?: boolean;
};

type RawOutcome = {
  name?: string;
  price?: number;
};

type RawMarket = {
  key?: string;
  outcomes?: RawOutcome[];
};

type RawBookmaker = {
  key?: string;
  title?: string;
  markets?: RawMarket[];
};

type RawEvent = {
  id?: string;
  sport_key?: string;
  home_team?: string;
  away_team?: string;
  commence_time?: string;
  bookmakers?: RawBookmaker[];
};

function findKboSportKey(sports: RawSport[]): string | null {
  const hit =
    sports.find((sport) => {
      const hay = `${sport.key ?? ""} ${sport.title ?? ""} ${sport.description ?? ""}`.toLowerCase();
      return (
        sport.active === true &&
        (sport.group ?? "").toLowerCase() === "baseball" &&
        (hay.includes("kbo") || hay.includes("korea baseball"))
      );
    }) ?? null;
  return hit?.key?.trim() || null;
}

function buildUrl(baseUrl: string, apiKey: string, pathName: string, query: Record<string, string>): string {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${pathName}`);
  url.searchParams.set("apiKey", apiKey);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function getBestSelection(
  event: RawEvent,
  side: "HOME" | "AWAY",
): { selectionCode: "HOME" | "AWAY"; selectionLabel: string; odds: number; bookmaker: string | null } | null {
  const targetName = side === "HOME" ? event.home_team : event.away_team;
  if (!targetName) return null;

  let best: { odds: number; bookmaker: string | null } | null = null;
  for (const bookmaker of event.bookmakers ?? []) {
    const h2h = (bookmaker.markets ?? []).find((market) => market.key === "h2h");
    if (!h2h) continue;
    const outcome = (h2h.outcomes ?? []).find(
      (item) => item.name?.trim().toLowerCase() === targetName.trim().toLowerCase(),
    );
    if (!outcome || typeof outcome.price !== "number" || !(outcome.price > 1)) {
      continue;
    }
    if (!best || outcome.price > best.odds) {
      best = { odds: outcome.price, bookmaker: bookmaker.title?.trim() || bookmaker.key?.trim() || null };
    }
  }
  if (!best) return null;
  return {
    selectionCode: side,
    selectionLabel: side === "HOME" ? "홈" : "원정",
    odds: best.odds,
    bookmaker: best.bookmaker,
  };
}

function normalizeEvent(
  event: RawEvent,
  sportKey: string,
  fetchedAt: string,
): KboNormalizedOverseasOddsGame | null {
  if (!event.id || !event.home_team || !event.away_team || !event.commence_time) {
    return null;
  }
  const home = resolveKboTeamIdentity(event.home_team);
  const away = resolveKboTeamIdentity(event.away_team);
  const homeSelection = getBestSelection(event, "HOME");
  const awaySelection = getBestSelection(event, "AWAY");
  if (!homeSelection || !awaySelection) {
    return null;
  }
  const kst = instantToKst(event.commence_time);
  return {
    provider: "THE_ODDS_API",
    sportKey,
    providerEventId: event.id,
    homeTeamProviderName: event.home_team,
    awayTeamProviderName: event.away_team,
    homeCanonicalTeamId: home.canonicalTeamId,
    awayCanonicalTeamId: away.canonicalTeamId,
    providerStartTime: event.commence_time,
    startTimeKst: kst ? `${kst.date}T${kst.time}:00+09:00` : null,
    capturedAt: fetchedAt,
    bookmakerPolicy: "AGGREGATE_BEST",
    marketKey: "h2h",
    ruleVerified: false,
    legalStatus: "NEEDS_LEGAL_REVIEW",
    mappingStatus:
      home.canonicalTeamId && away.canonicalTeamId ? "MATCHED" : "UNMATCHED",
    selections: [homeSelection, awaySelection],
  };
}

export class TheOddsApiKboProvider implements KboOverseasOddsProvider {
  readonly usage: KboCacheUsageStats;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly cwd?: string;

  constructor(options: { baseUrl?: string; apiKey?: string; cwd?: string } = {}) {
    this.usage = createKboCacheUsage();
    this.baseUrl =
      options.baseUrl?.trim() ||
      process.env.ODDS_API_BASE_URL?.trim() ||
      "https://api.the-odds-api.com/v4";
    this.apiKey = options.apiKey?.trim() || process.env.ODDS_API_KEY?.trim() || "";
    this.cwd = options.cwd;
  }

  async fetchMoneylineByDate(dateKst: string): Promise<KboOverseasOddsFetchResult> {
    if (!this.apiKey) {
      throw new KboIdentityCollectionError(
        "PROVIDER_REQUEST_FAILED",
        "ODDS_API_KEY is not configured",
      );
    }

    const sportsUrl = buildUrl(this.baseUrl, this.apiKey, "/sports", {});
    const sportsRaw = (await getKboTheOddsApiJson(
      `sports_dateKst=${dateKst}`,
      sportsUrl,
      this.usage,
      this.cwd,
    )) as RawSport[];
    const sportKey = findKboSportKey(Array.isArray(sportsRaw) ? sportsRaw : []);
    if (!sportKey) {
      throw new KboIdentityCollectionError(
        "PROVIDER_REQUEST_FAILED",
        "The Odds API active KBO sport key not found",
      );
    }

    const oddsUrl = buildUrl(
      this.baseUrl,
      this.apiKey,
      `/sports/${encodeURIComponent(sportKey)}/odds`,
      {
        regions: "eu",
        markets: "h2h",
        oddsFormat: "decimal",
        dateFormat: "iso",
      },
    );
    const fetchedAt = new Date().toISOString();
    const rawEvents = (await getKboTheOddsApiJson(
      `odds_dateKst=${dateKst}_sportKey=${sportKey}_markets=h2h_regions=eu`,
      oddsUrl,
      this.usage,
      this.cwd,
    )) as RawEvent[];

    const warnings: string[] = [];
    const missing: string[] = [];
    const games: KboNormalizedOverseasOddsGame[] = [];

    for (const event of Array.isArray(rawEvents) ? rawEvents : []) {
      const normalized = normalizeEvent(event, sportKey, fetchedAt);
      if (!normalized) {
        missing.push(`OVERSEAS_EVENT_INCOMPLETE:${event.id ?? "unknown"}`);
        continue;
      }
      if (!normalized.startTimeKst?.startsWith(dateKst)) continue;
      games.push(normalized);
    }

    games.sort((a, b) => a.providerEventId.localeCompare(b.providerEventId));

    if (games.length === 0) {
      warnings.push("OVERSEAS_ODDS_EMPTY");
    }

    return {
      provider: "THE_ODDS_API",
      sportKey,
      games,
      fetchedAt,
      warnings,
      missing,
    };
  }
}

export function createTheOddsApiKboProvider(options?: {
  baseUrl?: string;
  apiKey?: string;
  cwd?: string;
}): TheOddsApiKboProvider {
  return new TheOddsApiKboProvider(options);
}
