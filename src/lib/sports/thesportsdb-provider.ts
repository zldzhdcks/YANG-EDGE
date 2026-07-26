import type { AnalysisData } from "@/types/analysis";
import type { FeatureData } from "@/types/feature";
import type { GameData } from "@/types/game";
import type { SportData } from "@/types/sport";
import type { TodayPickData } from "@/types/todayPick";
import { buildGameId } from "@/lib/game-id";
import { buildHomeFeed } from "@/lib/home/build-home-feed";
import { getKstToday, utcToKst } from "@/lib/datetime/kst";
import { listDummyEngineGameIds } from "@/constants/dummyAnalysisData";
import type {
  GetGamesParams,
  SportsProvider,
  TotoData,
} from "./types";

/** TheSportsDB league IDs */
const LEAGUE_NPB = "4591";
const LEAGUE_KBO = "4830";

/** 지원 리그 → TheSportsDB league id */
const SUPPORTED_LEAGUES: { label: "NPB" | "KBO"; id: string }[] = [
  { label: "NPB", id: LEAGUE_NPB },
  { label: "KBO", id: LEAGUE_KBO },
];

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
 * - getTodayPick / getFeaturedGames / getTodayGames → buildHomeFeed + EDGE Engine
 *   (Engine AnalysisData 없는 경기는 스킵; Pick 없으면 null 반환 — Dummy 폴백 금지)
 *   (getTodayGames 는 Engine 0건이면 throw → Dummy 폴백)
 *
 * 미지원 (의도적으로 throw → DummyProvider 폴백):
 * - getAnalysis / getToto
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

    // 무료 와이어링은 야구(NPB/KBO)만 지원. 축구/농구 요청은 빈 목록으로 응답
    // (throw 하면 FallbackProvider가 Dummy 전체를 반환해 날짜 필터가 무너진다).
    if (params.sport && params.sport !== "all" && params.sport !== "baseball") {
      return [];
    }

    // 리그 필터: NPB/KBO 지정 시 해당 리그만, 미지정 시 둘 다 조회.
    const requestedLeague = params.league?.trim().toUpperCase();
    const leagues = requestedLeague
      ? SUPPORTED_LEAGUES.filter((l) => l.label === requestedLeague)
      : SUPPORTED_LEAGUES;

    // 지원하지 않는 리그(예: EPL)를 명시하면 빈 목록.
    if (leagues.length === 0) return [];

    const date = params.date ?? getKstToday();
    const eventGroups = await Promise.all(
      leagues.map((l) => this.fetchEventsDay(date, l.id)),
    );

    const games = eventGroups
      .flat()
      .map(mapEventToGame)
      .filter((game): game is GameData => game !== null);

    // 이벤트가 없으면 빈 배열 반환 → 화면은 "등록된 경기가 없습니다" (fallback 아님).
    // 실제 네트워크/HTTP 오류만 throw → FallbackProvider가 Dummy로 폴백.
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

  async getTodayPick(): Promise<TodayPickData | null> {
    // null = 오늘 추천 기준 미충족 (정상). throw 하면 Fallback이 Dummy(과거 고정일)로
    // 억지 추천을 보여 주므로, 빈 Pick 은 절대 throw 하지 않는다.
    // 네트워크/HTTP 오류는 getGames 가 throw → Fallback 유지.
    const feed = await buildHomeFeed(await this.getGames());
    return feed.pick;
  }

  async getFeaturedGames(): Promise<FeatureData[]> {
    const feed = await buildHomeFeed(await this.getGames());
    // PASS 제외 후 0건이어도 정상 — Home 이 안내 문구를 표시한다 (Dummy 폴백 금지)
    return feed.featured;
  }

  async getTodayGames(): Promise<SportData[]> {
    const feed = await buildHomeFeed(await this.getGames());
    // 종목 카드는 경기 수만 있어도 표시 가능 — Engine 0건이면 Dummy로 폴백
    if (feed.ranked.length === 0) {
      throw new SportsApiError(
        "No EDGE Engine rows for TheSportsDB games",
        404,
        "today-games",
      );
    }
    return feed.sports;
  }

  async getFeatured(): Promise<FeatureData[]> {
    return this.getFeaturedGames();
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

function mapLeagueLabel(idLeague?: string, strLeague?: string): string {
  if (idLeague === LEAGUE_NPB) return "NPB";
  if (idLeague === LEAGUE_KBO) return "KBO";
  return strLeague?.trim() || "Unknown";
}

/** 엔진 분석 데이터가 있는 gameId만 상세(분석) 이동 허용 */
const ENGINE_READY_GAME_IDS = new Set(listDummyEngineGameIds());

function mapEventToGame(event: TheSportsDbEvent): GameData | null {
  if (!event.idEvent || !event.strHomeTeam || !event.strAwayTeam) {
    return null;
  }

  const league = mapLeagueLabel(event.idLeague, event.strLeague);
  const id = buildGameId(league, event.strHomeTeam, event.strAwayTeam);

  // TheSportsDB 시간은 UTC → 화면 표기는 KST 로 변환
  const kst = utcToKst(event.dateEvent ?? "", event.strTime);

  return {
    id,
    sport: "baseball",
    league,
    homeTeam: event.strHomeTeam,
    awayTeam: event.strAwayTeam,
    startTime: kst?.time ?? "TBD",
    date: kst?.date ?? event.dateEvent ?? getKstToday(),
    aiAnalysisAvailable: ENGINE_READY_GAME_IDS.has(id),
    externalId: event.idEvent,
    externalProvider: "thesportsdb",
  };
}
