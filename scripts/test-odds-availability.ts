/**
 * 배당 상태·KST 날짜 경계 안전성 검증.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-odds-availability.ts
 */
import { GET as getGamesRoute } from "../src/app/api/games/route";
import {
  buildProviderErrorOddsResult,
  classifyUnavailableOdds,
  type OddsEnrichmentMeta,
} from "../src/lib/games/attach-odds";
import {
  buildOddsData,
  matchOddsToGame,
  normalizeTeamNameForOdds,
} from "../src/lib/odds";
import {
  getOddsAvailabilityLabel,
  type GameWithOdds,
  type OddsAvailability,
} from "../src/types/game-with-odds";
import type { GameData } from "../src/types/game";

type GamesResponse = {
  games: GameWithOdds[];
  meta: { odds: OddsEnrichmentMeta };
};

const FIXED_NOW = new Date("2026-07-26T13:00:00.000Z"); // KST 22:00

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`검증 실패: ${message}`);
}

function game(input: Partial<GameData> & Pick<GameData, "id" | "date">): GameData {
  return {
    id: input.id,
    sport: input.sport ?? "baseball",
    league: input.league ?? "MLB",
    homeTeam: input.homeTeam ?? "Home Team",
    awayTeam: input.awayTeam ?? "Away Team",
    startTime: input.startTime ?? "12:00",
    date: input.date,
    aiAnalysisAvailable: false,
    externalId: input.externalId,
    externalProvider: input.externalProvider,
  };
}

function odds(input: {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
}) {
  return buildOddsData({
    externalEventId: input.id,
    sportKey: "baseball_mlb",
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    commenceTime: input.commenceTime,
    bookmakers: [
      {
        key: "test",
        title: "Test",
        lastUpdate: input.commenceTime,
        markets: [
          {
            key: "h2h",
            lastUpdate: input.commenceTime,
            outcomes: [
              { name: input.homeTeam, price: 1.9 },
              { name: input.awayTeam, price: 2.1 },
            ],
          },
        ],
      },
    ],
    lastUpdated: input.commenceTime,
    source: "the-odds-api",
  });
}

async function load(date: string): Promise<GamesResponse> {
  const response = await getGamesRoute(
    new Request(`http://localhost/api/games?date=${date}`),
  );
  assert(response.status === 200, `${date} /api/games HTTP 200`);
  return (await response.json()) as GamesResponse;
}

function leagueItems(
  response: GamesResponse,
  league: "MLB" | "MLS" | "KBO" | "NPB",
): GameWithOdds[] {
  return response.games.filter((item) => item.game.league === league);
}

function counts(items: GameWithOdds[]): Record<OddsAvailability, number> {
  const result: Record<OddsAvailability, number> = {
    available: 0,
    "not-found": 0,
    "not-yet-posted": 0,
    "market-closed": 0,
    "historical-not-loaded": 0,
    "provider-error": 0,
  };
  for (const item of items) result[item.oddsAvailability] += 1;
  return result;
}

function fingerprint(items: GameWithOdds[]): string {
  return JSON.stringify(
    items.map((item) => ({
      id: item.game.id,
      availability: item.oddsAvailability,
      reason: item.oddsUnavailableReason,
      oddsId: item.odds?.externalEventId ?? null,
      matched: item.oddsMatch.matched,
    })),
  );
}

async function main() {
  const july26 = await load("2026-07-26");
  const july27 = await load("2026-07-27");
  const july27Again = await load("2026-07-27");

  const mlb26 = leagueItems(july26, "MLB");
  const mls26 = leagueItems(july26, "MLS");
  const mlb27 = leagueItems(july27, "MLB");
  const mlb26Counts = counts(mlb26);
  const mls26Counts = counts(mls26);
  const mlb27Counts = counts(mlb27);

  assert(mlb26.length === 15, "2026-07-26 MLB 15경기");
  assert(mls26.length === 15, "2026-07-26 MLS 15경기");
  assert(mlb27.length === 15, "2026-07-27 MLB 15경기");
  assert(mlb26Counts.available === 0, "07-26 MLB 다음 날 배당 오매칭 0");
  assert(mls26Counts.available === 0, "07-26 MLS 미래 슬레이트 오매칭 0");
  assert(
    mlb26Counts["market-closed"] +
      mlb26Counts["historical-not-loaded"] ===
      15,
    "07-26 MLB는 마감 또는 과거 미수집",
  );
  assert(
    mls26Counts["market-closed"] +
      mls26Counts["historical-not-loaded"] ===
      15,
    "07-26 MLS는 마감 또는 과거 미수집",
  );
  assert(mlb27Counts.available === 15, "07-27 MLB 배당 15/15 유지");
  assert(
    mlb27.every(
      (item) =>
        item.oddsMatch.matched &&
        item.odds?.bestHomeOdds != null &&
        item.odds.bestAwayOdds != null,
    ),
    "07-27 MLB 배당 필드 완전",
  );

  // 같은 매치업이라도 KST 날짜가 다르면 external ID까지 같아도 매칭 금지.
  const previousDay = game({
    id: "date-boundary",
    date: "2026-07-26",
    startTime: "02:00",
    homeTeam: "Detroit Tigers",
    awayTeam: "Kansas City Royals",
    externalId: "same-id",
  });
  const nextDayOdds = odds({
    id: "same-id",
    homeTeam: "Detroit Tigers",
    awayTeam: "Kansas City Royals",
    commenceTime: "2026-07-26T17:00:00.000Z", // KST 07-27 02:00
  });
  assert(
    matchOddsToGame(previousDay, [nextDayOdds]) === null,
    "다른 KST 날짜 external ID 오매칭 금지",
  );

  // 기존 ±3시간 기준 유지.
  const kbo = game({
    id: "kbo-safe",
    date: "2026-07-27",
    startTime: "18:00",
    league: "KBO",
    homeTeam: "Doosan Bears",
    awayTeam: "Samsung Lions",
  });
  const withinTolerance = odds({
    id: "kbo-odds",
    homeTeam: "Doosan Bears",
    awayTeam: "Samsung Lions",
    commenceTime: "2026-07-27T10:30:00.000Z", // KST 19:30
  });
  const outsideTolerance = odds({
    id: "kbo-odds-late",
    homeTeam: "Doosan Bears",
    awayTeam: "Samsung Lions",
    commenceTime: "2026-07-27T13:01:00.000Z", // KST 22:01
  });
  assert(matchOddsToGame(kbo, [withinTolerance]) != null, "KBO ±3시간 내 유지");
  assert(matchOddsToGame(kbo, [outsideTolerance]) === null, "±3시간 확대 금지");

  const historical = classifyUnavailableOdds(
    game({ id: "historical", date: "2026-07-25" }),
    {
      now: FIXED_NOW,
      leagueResolved: true,
      providerFailed: false,
      oddsEvents: [],
    },
  );
  const closed = classifyUnavailableOdds(
    game({
      id: "closed",
      date: "2026-07-26",
      startTime: "10:00",
    }),
    {
      now: FIXED_NOW,
      leagueResolved: true,
      providerFailed: false,
      oddsEvents: [],
    },
  );
  const future = classifyUnavailableOdds(
    game({ id: "future", date: "2026-07-28" }),
    {
      now: FIXED_NOW,
      leagueResolved: true,
      providerFailed: false,
      oddsEvents: [],
    },
  );
  const providerError = classifyUnavailableOdds(
    game({ id: "provider-error", date: "2026-07-28" }),
    {
      now: FIXED_NOW,
      leagueResolved: true,
      providerFailed: true,
      oddsEvents: [],
    },
  );

  assert(historical.availability === "historical-not-loaded", "과거 배당 상태");
  assert(closed.availability === "market-closed", "당일 종료 경기 상태");
  assert(future.availability === "not-yet-posted", "미래 무배당 상태");
  assert(providerError.availability === "provider-error", "Provider 실패 상태");
  const providerFallback = buildProviderErrorOddsResult([
    game({ id: "provider-fallback", date: "2026-07-28" }),
  ]);
  assert(
    providerFallback.items[0].oddsAvailability === "provider-error" &&
      providerFallback.meta.providerError === 1 &&
      providerFallback.meta.ok === false,
    "Odds Provider 전체 실패 fallback",
  );
  assert(
    getOddsAvailabilityLabel(historical.availability) === "과거 배당 미수집" &&
      getOddsAvailabilityLabel(closed.availability) === "배당 마감" &&
      getOddsAvailabilityLabel(future.availability) === "배당 준비중" &&
      getOddsAvailabilityLabel(providerError.availability) === "배당 조회 실패",
    "GameCard 상태 문구",
  );

  // 표시용 한글화가 Odds 입력 원본에 섞이지 않았는지 확인.
  assert(
    mlb27.every(
      (item) =>
        /^[\x00-\x7F]+$/.test(item.game.homeTeam) &&
        /^[\x00-\x7F]+$/.test(item.game.awayTeam),
    ),
    "GameData 원본 영문 유지",
  );
  assert(
    normalizeTeamNameForOdds(mlb27[0].game.homeTeam) ===
      normalizeTeamNameForOdds(mlb27[0].odds?.homeTeam ?? ""),
    "Odds 매칭 입력은 원본명",
  );
  assert(
    fingerprint(mlb27) === fingerprint(leagueItems(july27Again, "MLB")),
    "동일 입력 결정성",
  );

  console.log(
    JSON.stringify(
      {
        mlb20260726: mlb26Counts,
        mlb20260727: mlb27Counts,
        mls20260726: mls26Counts,
        nextDayMismatchCount: 0,
        labels: {
          marketClosed: getOddsAvailabilityLabel("market-closed"),
          historicalNotLoaded: getOddsAvailabilityLabel(
            "historical-not-loaded",
          ),
          notYetPosted: getOddsAvailabilityLabel("not-yet-posted"),
          notFound: getOddsAvailabilityLabel("not-found"),
          providerError: getOddsAvailabilityLabel("provider-error"),
        },
        meta20260726: {
          available: july26.meta.odds.available,
          marketClosed: july26.meta.odds.marketClosed,
          historicalNotLoaded: july26.meta.odds.historicalNotLoaded,
          notYetPosted: july26.meta.odds.notYetPosted,
          notFound: july26.meta.odds.notFound,
          providerError: july26.meta.odds.providerError,
        },
        apiUsage: july27.meta.odds.usage,
        kboNpbSafeMatchRegression: true,
        koreanizationAffectsMatching: false,
        deterministic: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
