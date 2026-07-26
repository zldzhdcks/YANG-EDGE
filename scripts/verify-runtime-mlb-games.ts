/**
 * 2026-07-27 KST MLB 런타임 연결 검증.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/verify-runtime-mlb-games.ts
 *
 * 실제 Route Handler를 호출하되 응답이나 로그에 API 키를 출력하지 않는다.
 */
import { GET as getGamesRoute } from "../src/app/api/games/route";
import { getMlbGamesForDate } from "../src/lib/games/mlb-games";
import { groupGamesByLeague } from "../src/lib/games/group";
import {
  filterGamesClientSide,
  type RecommendationFilterId,
} from "../src/lib/games/recommendation-filter";
import type { GameWithOdds } from "../src/types/game-with-odds";

const TARGET_DATE_KST = "2026-07-27";
const ROUTE_URL = `http://localhost/api/games?date=${TARGET_DATE_KST}`;

type SourceMeta = {
  ok: boolean;
  count: number;
  skipped?: boolean;
  cached?: boolean;
  error?: string;
  requestsRemaining?: number | null;
  requestsLimit?: number | null;
};

type RuntimeResponse = {
  games: GameWithOdds[];
  meta: {
    status: "success" | "partial" | "error";
    sources: {
      sports: SourceMeta;
      apiBaseballMlb: SourceMeta;
      football: SourceMeta;
    };
    odds?: {
      matchedCount?: number;
      unmatchedGameCount?: number;
      allCached?: boolean;
    };
    baseballScheduleComplement?: {
      duplicateMergedCount?: number;
      oddsOnlyAddedCount?: number;
    } | null;
  };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`검증 실패: ${message}`);
}

async function callRoute(url = ROUTE_URL): Promise<{
  status: number;
  body: RuntimeResponse;
}> {
  const response = await getGamesRoute(new Request(url));
  const body = (await response.json()) as RuntimeResponse;
  return { status: response.status, body };
}

function fixtureKey(item: GameWithOdds): string {
  const { game } = item;
  return [
    game.league,
    game.homeTeam.toLowerCase().replace(/[^a-z0-9]/g, ""),
    game.awayTeam.toLowerCase().replace(/[^a-z0-9]/g, ""),
    game.date,
    game.startTime,
  ].join("|");
}

function filteredCount(
  games: GameWithOdds[],
  recommendation: RecommendationFilterId,
): number {
  return filterGamesClientSide(games, {
    search: "",
    sport: "all",
    recommendation,
  }).filter((item) => item.game.league === "MLB").length;
}

async function verifyPartialIsolation(): Promise<{
  status: string;
  mlbFailed: boolean;
  otherSourcesHealthy: boolean;
  otherGameCount: number;
}> {
  const originalBaseUrl = process.env.BASEBALL_API_BASE_URL;
  process.env.BASEBALL_API_BASE_URL = "http://127.0.0.1:1";
  try {
    const { status, body } = await callRoute();
    const otherSourcesHealthy =
      body.meta.sources.sports.ok || body.meta.sources.football.ok;
    const otherGameCount = body.games.filter(
      (item) => item.game.league !== "MLB",
    ).length;

    assert(status === 200, "MLB 실패 시 HTTP 200이어야 함");
    assert(body.meta.status === "partial", "MLB 실패 시 meta.status=partial");
    assert(!body.meta.sources.apiBaseballMlb.ok, "MLB source 실패가 기록되어야 함");
    assert(otherSourcesHealthy, "다른 일정 source가 독립적으로 성공해야 함");

    return {
      status: body.meta.status,
      mlbFailed: !body.meta.sources.apiBaseballMlb.ok,
      otherSourcesHealthy,
      otherGameCount,
    };
  } finally {
    if (originalBaseUrl == null) {
      delete process.env.BASEBALL_API_BASE_URL;
    } else {
      process.env.BASEBALL_API_BASE_URL = originalBaseUrl;
    }
  }
}

async function main() {
  const partialIsolation = await verifyPartialIsolation();

  const rawFirst = await getMlbGamesForDate(TARGET_DATE_KST);
  const rawSecond = await getMlbGamesForDate(TARGET_DATE_KST);
  assert(rawFirst.games.length === 15, "API-BASEBALL 원본 MLB 경기는 15개여야 함");
  assert(rawSecond.cached, "동일 날짜 재호출은 MLB 캐시를 사용해야 함");
  assert(
    rawFirst.fetchedAt === rawSecond.fetchedAt,
    "캐시 재호출은 동일 응답을 재사용해야 함",
  );

  const { status, body } = await callRoute();
  assert(status === 200, "정상 /api/games 응답은 HTTP 200이어야 함");

  const mlb = body.games.filter((item) => item.game.league === "MLB");
  const mlbWithOdds = mlb.filter(
    (item) => item.oddsMatch.matched && item.odds != null,
  );
  const externalIds = new Set(
    mlb.map(
      (item) =>
        `${item.game.externalProvider ?? ""}:${item.game.externalId ?? ""}`,
    ),
  );
  const fixtureKeys = new Set(mlb.map(fixtureKey));
  const duplicateCount =
    mlb.length - Math.min(externalIds.size, fixtureKeys.size);
  const invalidKst = mlb.filter(
    (item) =>
      item.game.date !== TARGET_DATE_KST ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.game.startTime),
  );
  const analyzed = mlb.filter(
    (item) =>
      item.game.aiAnalysisAvailable || (item.recommendation ?? null) != null,
  );

  assert(mlb.length === 15, "/api/games 최종 MLB 경기는 15개여야 함");
  assert(duplicateCount === 0, "최종 MLB 일정에 중복이 없어야 함");
  assert(invalidKst.length === 0, "모든 MLB 경기가 대상 KST 날짜/시간이어야 함");
  assert(analyzed.length === 0, "MLB는 모두 분석 준비중이어야 함");
  assert(filteredCount(mlb, "all") === 15, "추천 필터 전체에는 MLB가 보여야 함");
  assert(
    filteredCount(mlb, "analyzable") === 0,
    "분석 가능 필터에서는 MLB가 제외되어야 함",
  );

  const groups = groupGamesByLeague(body.games);
  const mlbGroup = groups.find((group) => group.league === "MLB");
  assert(mlbGroup != null, "MLB 리그 그룹이 있어야 함");
  assert(mlbGroup.visibleGames.length === 10, "MLB 최초 노출은 10경기여야 함");
  assert(mlbGroup.hiddenCount === 5 && mlbGroup.hasMore, "MLB 더 보기 5경기");

  const configuredKey = (
    process.env.BASEBALL_API_KEY ??
    process.env.FOOTBALL_API_KEY ??
    ""
  ).trim();
  const responseText = JSON.stringify(body);
  const apiKeyLeaked =
    configuredKey.length > 0 && responseText.includes(configuredKey);
  assert(!apiKeyLeaked, "응답에 API 키가 포함되면 안 됨");

  const firstTime = mlb[0]?.game.startTime ?? null;
  const lastTime = mlb.at(-1)?.game.startTime ?? null;
  const noOdds = mlb
    .filter((item) => !item.oddsMatch.matched)
    .map((item) => ({
      game: `${item.game.awayTeam} @ ${item.game.homeTeam}`,
      reason: "일치하는 MLB h2h Odds 이벤트 없음",
    }));

  console.log(
    JSON.stringify(
      {
        targetDateKst: TARGET_DATE_KST,
        apiBaseballOriginalMlbGames: rawFirst.games.length,
        runtimeFinalMlbGames: mlb.length,
        mlbOddsMatched: mlbWithOdds.length,
        mlbWithoutOdds: noOdds,
        duplicateMlbGames: duplicateCount,
        kst: {
          invalidCount: invalidKst.length,
          firstTime,
          lastTime,
        },
        gamesUi: {
          mlbGroup: true,
          totalCount: mlbGroup.totalCount,
          initialVisible: mlbGroup.visibleGames.length,
          hiddenBehindMore: mlbGroup.hiddenCount,
          allFilterCount: filteredCount(mlb, "all"),
          analyzableFilterCount: filteredCount(mlb, "analyzable"),
        },
        analysisPendingCount: mlb.length - analyzed.length,
        sourceCounts: body.meta.sources,
        existingPipelines: {
          kboNpbFinalCount: body.games.filter((item) =>
            ["KBO", "NPB"].includes(item.game.league),
          ).length,
          footballFinalCount: body.games.filter(
            (item) => item.game.sport === "football",
          ).length,
        },
        partialIsolation,
        cache: {
          firstCallCached: rawFirst.cached,
          repeatedCallCached: rawSecond.cached,
          sameFetchedAt: rawFirst.fetchedAt === rawSecond.fetchedAt,
          ttlProtected: true,
        },
        apiUsage: rawFirst.usage,
        apiKeyLeaked,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/apiKey=[^&\s]+/gi, "apiKey=***"));
  process.exitCode = 1;
});
