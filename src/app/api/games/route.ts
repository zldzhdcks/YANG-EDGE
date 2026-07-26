import { NextResponse } from "next/server";
import { getSportsProvider } from "@/lib/sports";
import { getFootballGamesForDate } from "@/lib/games/football-games";
import { getMlbGamesForDate } from "@/lib/games/mlb-games";
import { mergeGames } from "@/lib/games/merge-games";
import { sortGames } from "@/lib/games/sort";
import {
  complementBaseballScheduleWithOdds,
} from "@/lib/games/complement-baseball-schedule";
import {
  attachOddsToGames,
  buildProviderErrorOddsResult,
  type OddsEnrichmentMeta,
} from "@/lib/games/attach-odds";
import { attachRecommendationGrades } from "@/lib/games/attach-recommendation-grades";
import { toBareGameWithOdds, type GameWithOdds } from "@/types/game-with-odds";
import type { GameData } from "@/types/game";
import { getKstToday } from "@/lib/datetime/kst";

/**
 * GET /api/games?date=YYYY-MM-DD&sport=&league=
 *
 * 두 Provider를 **병렬** 조회해 하나의 목록으로 병합한다.
 * - 야구 등: SportsProvider (TheSportsDB 등 — Dummy 자동 폴백 없음)
 * - 축구:    FootballProvider (API-Football, 관심 리그만)
 *
 * 오류 격리: 한쪽 실패해도 다른 쪽 일정은 표시 (status=partial).
 * 둘 다 실패하면 status=error + 502.
 *
 * 응답: { games, meta } — meta 에 provider별 source/usage 포함.
 * API 키는 서버에서만 사용하며 로그·응답에 넣지 않는다.
 */

type ProviderMeta = {
  ok: boolean;
  count: number;
  error?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const sportParam = searchParams.get("sport");
  const sport =
    sportParam && sportParam !== "all"
      ? (sportParam as GameData["sport"])
      : "all";
  const league = searchParams.get("league") ?? undefined;
  const validDate = !date || /^\d{4}-\d{2}-\d{2}$/.test(date);
  const dateKst = date && validDate ? date : getKstToday();
  const wantBaseball = sport === "all" || sport === "baseball";
  const canQueryMlb =
    validDate &&
    wantBaseball &&
    (!league || league.trim().toUpperCase() === "MLB");

  // 축구는 날짜가 있어야 조회 가능 (API-Football date 필수)
  const canQueryFootball =
    !!date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    sport !== "baseball" &&
    sport !== "basketball";

  const [sportsSettled, mlbSettled, footballSettled] =
    await Promise.allSettled([
      getSportsProvider().getGames({ date, sport, league }),
      canQueryMlb ? getMlbGamesForDate(dateKst) : Promise.resolve(null),
      canQueryFootball
        ? getFootballGamesForDate(date)
        : Promise.resolve(null),
    ]);

  const sportsMeta: ProviderMeta = { ok: false, count: 0 };
  let sportsGames: GameData[] = [];

  if (sportsSettled.status === "fulfilled") {
    sportsGames = sportsSettled.value;
    sportsMeta.ok = true;
    sportsMeta.count = sportsGames.length;
  } else {
    sportsMeta.error = toSafeMessage(sportsSettled.reason);
  }

  const mlbMeta: ProviderMeta & {
    skipped?: boolean;
    cached?: boolean;
    requestsRemaining?: number | null;
    requestsLimit?: number | null;
    leagueId?: number;
    season?: number;
  } = { ok: false, count: 0 };
  let mlbGames: GameData[] = [];

  if (mlbSettled.status === "fulfilled") {
    if (mlbSettled.value === null) {
      mlbMeta.ok = true;
      mlbMeta.skipped = true;
    } else {
      const value = mlbSettled.value;
      mlbGames = value.games;
      mlbMeta.ok = true;
      mlbMeta.count = value.games.length;
      mlbMeta.cached = value.cached;
      mlbMeta.requestsRemaining = value.usage.requestsRemaining;
      mlbMeta.requestsLimit = value.usage.requestsLimit;
      mlbMeta.leagueId = value.leagueId;
      mlbMeta.season = value.season;
    }
  } else {
    mlbMeta.error = toSafeMessage(mlbSettled.reason);
  }

  const footballMeta: ProviderMeta & {
    skipped?: boolean;
    totalFixtures?: number;
    keptFixtures?: number;
    cached?: boolean;
    usage?: unknown;
  } = { ok: false, count: 0 };
  let footballGames: GameData[] = [];

  if (footballSettled.status === "fulfilled") {
    if (footballSettled.value === null) {
      footballMeta.ok = true;
      footballMeta.skipped = true;
    } else {
      const value = footballSettled.value;
      footballGames = value.games;
      footballMeta.ok = true;
      footballMeta.count = value.games.length;
      footballMeta.totalFixtures = value.totalFixtures;
      footballMeta.keptFixtures = value.keptFixtures;
      footballMeta.cached = value.cached;
      footballMeta.usage = value.usage;
    }
  } else {
    footballMeta.error = toSafeMessage(footballSettled.reason);
  }

  const anySourceSucceeded =
    sportsMeta.ok ||
    (!mlbMeta.skipped && mlbMeta.ok) ||
    (!footballMeta.skipped && footballMeta.ok);

  // 실제로 시도한 모든 일정 source가 실패한 경우만 error.
  if (!anySourceSucceeded) {
    return NextResponse.json(
      {
        games: [],
        meta: {
          status: "error",
          date: date ?? null,
          sources: {
            sports: sportsMeta,
            apiBaseballMlb: mlbMeta,
            football: footballMeta,
          },
        },
        message: "경기 일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 502 },
    );
  }

  // 야구 일정 보완: Provider 기준 일정에 없는 KBO/NPB/MLB Odds 이벤트만 추가
  // (동일 getOdds 호출은 Provider 캐시로 attachOddsToGames 와 공유)
  let baseballComplementMeta: Awaited<
    ReturnType<typeof complementBaseballScheduleWithOdds>
  >["meta"] | null = null;

  let combinedSportsGames = [...sportsGames, ...mlbGames];
  if (wantBaseball && (sportsMeta.ok || mlbMeta.ok)) {
    const baseballPrimary = combinedSportsGames.filter(
      (g) => g.sport === "baseball",
    );
    const nonBaseballSports = combinedSportsGames.filter(
      (g) => g.sport !== "baseball",
    );
    const wantedLeague = league?.trim().toUpperCase();
    const complementLeagues: Array<"KBO" | "NPB" | "MLB"> = [];
    if (sportsMeta.ok && (!wantedLeague || wantedLeague === "KBO")) {
      complementLeagues.push("KBO");
    }
    if (sportsMeta.ok && (!wantedLeague || wantedLeague === "NPB")) {
      complementLeagues.push("NPB");
    }
    if (mlbMeta.ok && (!wantedLeague || wantedLeague === "MLB")) {
      complementLeagues.push("MLB");
    }
    try {
      const complemented = await complementBaseballScheduleWithOdds(
        baseballPrimary,
        dateKst,
        complementLeagues,
      );
      baseballComplementMeta = complemented.meta;
      combinedSportsGames = [...nonBaseballSports, ...complemented.games];
    } catch {
      // 보완 실패 시 Provider 기준 일정만 유지
      baseballComplementMeta = null;
    }
  }

  let games = mergeGames(combinedSportsGames, footballGames);

  // 병합 후에도 요청 필터를 일관 적용 (축구는 Provider 단계 필터가 없음)
  if (sport !== "all") {
    games = games.filter((g) => g.sport === sport);
  }
  if (league) {
    const wanted = league.toLowerCase();
    games = games.filter((g) => g.league.toLowerCase() === wanted);
  }
  games = sortGames(games);

  // 배당 연결 — 일정 Provider 실패 처리와 완전 분리.
  // Odds 실패 시에도 일정은 HTTP 200 으로 정상 반환한다.
  let items: GameWithOdds[] = games.map(toBareGameWithOdds);
  let oddsMeta: OddsEnrichmentMeta;
  try {
    const enriched = await attachOddsToGames(games);
    items = enriched.items;
    oddsMeta = enriched.meta;
  } catch {
    const fallback = buildProviderErrorOddsResult(games);
    items = fallback.items;
    oddsMeta = fallback.meta;
  }

  // 추천 등급 — Odds와 분리. 실패해도 일정·배당 표시는 유지.
  try {
    items = await attachRecommendationGrades(items);
  } catch {
    // 등급 enrichment 실패 시 recommendation=null 유지
  }

  const partial =
    !sportsMeta.ok ||
    (!mlbMeta.skipped && !mlbMeta.ok) ||
    (!footballMeta.skipped && !footballMeta.ok);

  return NextResponse.json(
    {
      games: items,
      meta: {
        status: partial ? "partial" : "success",
        date: date ?? null,
        sources: {
          sports: sportsMeta,
          apiBaseballMlb: mlbMeta,
          football: footballMeta,
        },
        baseballScheduleComplement: baseballComplementMeta,
        odds: oddsMeta,
      },
    },
    { status: 200 },
  );
}

/** 오류 메시지에서 키 흔적 제거 */
function toSafeMessage(reason: unknown): string {
  const raw =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "Unknown error";

  return raw
    .replace(/apiKey=[^&\s]+/gi, "apiKey=***")
    .replace(/x-apisports-key["\s:=]+[^\s"',}]+/gi, "x-apisports-key=***");
}
