import type { AnalysisData } from "@/types/analysis";
import type { FeatureData } from "@/types/feature";
import type { GameData } from "@/types/game";
import type { SportData } from "@/types/sport";
import type { TodayPickData } from "@/types/todayPick";
import type {
  GetGamesParams,
  SportsProvider,
  TotoData,
} from "./types";

/** TheSportsDB league IDs */
const LEAGUE_NPB = "4591";
const LEAGUE_KBO = "4830";

type TheSportsDbEvent = {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strLeague?: string;
  idLeague?: string;
  dateEvent?: string;
  strTime?: string;
  strSport?: string;
};

type TheSportsDbEventsResponse = {
  events: TheSportsDbEvent[] | null;
};

/**
 * TheSportsDB v1 Provider (테스트용)
 *
 * URL: {SPORTS_API_BASE_URL}/{SPORTS_API_KEY}/{endpoint}
 * 예: https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=2026-07-24&l=4591
 *
 * 지원:
 * - getGames → eventsday.php (NPB/KBO 야구 일정) → GameData[]
 *
 * 미지원 (의도적으로 throw → DummyProvider 폴백):
 * - getAnalysis / getToto / getTodayPick / getTodayGames / getFeatured
 *
 * 무료 플랜 제한 (문서 기준):
 * - eventsday: 요청당 최대 3건
 * - eventsnextleague / eventspastleague: 요청당 최대 1건
 * - 키는 경로에 포함. Authorization 헤더 불필요.
 * - 키를 NEXT_PUBLIC_* 에 넣지 말 것.
 */
export class TheSportsDbProvider implements SportsProvider {
  readonly kind = "thesportsdb" as const;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey.trim();
  }

  async getGames(params: GetGamesParams = {}): Promise<GameData[]> {
    if (!this.apiKey) {
      throw new SportsApiError(
        "SPORTS_API_KEY is not configured",
        0,
        "eventsday.php",
      );
    }

    if (params.sport && params.sport !== "all" && params.sport !== "baseball") {
      throw new SportsApiError(
        `TheSportsDB free wiring supports baseball (NPB/KBO) only (sport=${params.sport})`,
        501,
        "eventsday.php",
      );
    }

    const date = params.date ?? todayUtcDate();
    const [npbEvents, kboEvents] = await Promise.all([
      this.fetchEventsDay(date, LEAGUE_NPB),
      this.fetchEventsDay(date, LEAGUE_KBO),
    ]);

    const games = [
      ...npbEvents.map(mapEventToGame),
      ...kboEvents.map(mapEventToGame),
    ].filter((game): game is GameData => game !== null);

    if (games.length === 0) {
      throw new SportsApiError(
        `No TheSportsDB events for ${date} (NPB/KBO)`,
        404,
        "eventsday.php",
      );
    }

    return games;
  }

  async getAnalysis(gameId: string): Promise<AnalysisData | null> {
    void gameId;
    throw new SportsApiError(
      "TheSportsDB has no EDGE analysis endpoint",
      501,
      "analysis",
    );
  }

  async getToto(): Promise<TotoData> {
    throw new SportsApiError(
      "TheSportsDB has no EDGE Combo endpoint",
      501,
      "toto",
    );
  }

  async getTodayPick(): Promise<TodayPickData> {
    throw new SportsApiError(
      "TheSportsDB has no EDGE Pick endpoint",
      501,
      "today-pick",
    );
  }

  async getTodayGames(): Promise<SportData[]> {
    throw new SportsApiError(
      "TheSportsDB has no home sport-summary endpoint",
      501,
      "today-games",
    );
  }

  async getFeatured(): Promise<FeatureData[]> {
    throw new SportsApiError(
      "TheSportsDB has no featured endpoint",
      501,
      "featured",
    );
  }

  private async fetchEventsDay(
    date: string,
    leagueId: string,
  ): Promise<TheSportsDbEvent[]> {
    const path = `eventsday.php?d=${encodeURIComponent(date)}&l=${encodeURIComponent(leagueId)}`;
    const data = await this.getJson<TheSportsDbEventsResponse>(path);
    return Array.isArray(data.events) ? data.events : [];
  }

  /** TheSportsDB v1: {base}/{key}/{endpoint}?query */
  private async getJson<T>(endpointAndQuery: string): Promise<T> {
    const cleaned = endpointAndQuery.replace(/^\//, "");
    const url = `${this.baseUrl}/${this.apiKey}/${cleaned}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network request failed";
      throw new SportsApiError(message, 0, cleaned);
    }

    if (!response.ok) {
      let detail = response.statusText || "Unknown error";
      try {
        const body = (await response.json()) as { message?: string };
        if (typeof body.message === "string" && body.message.length > 0) {
          detail = body.message;
        }
      } catch {
        // ignore
      }
      throw new SportsApiError(
        `Sports API GET ${cleaned} failed (${response.status}): ${detail}`,
        response.status,
        cleaned,
      );
    }

    return (await response.json()) as T;
  }
}

export class SportsApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "SportsApiError";
    this.status = status;
    this.path = path;
  }
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapLeagueLabel(idLeague?: string, strLeague?: string): string {
  if (idLeague === LEAGUE_NPB) return "NPB";
  if (idLeague === LEAGUE_KBO) return "KBO";
  return strLeague?.trim() || "Unknown";
}

function mapStartTime(strTime?: string): string {
  if (!strTime || strTime === "00:00:00" || strTime === "null") return "TBD";
  return strTime.slice(0, 5);
}

function mapEventToGame(event: TheSportsDbEvent): GameData | null {
  if (!event.idEvent || !event.strHomeTeam || !event.strAwayTeam) {
    return null;
  }

  return {
    id: event.idEvent,
    sport: "baseball",
    league: mapLeagueLabel(event.idLeague, event.strLeague),
    homeTeam: event.strHomeTeam,
    awayTeam: event.strAwayTeam,
    startTime: mapStartTime(event.strTime),
    date: event.dateEvent || todayUtcDate(),
    aiAnalysisAvailable: false,
  };
}
