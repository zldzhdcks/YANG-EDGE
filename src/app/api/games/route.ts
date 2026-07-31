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
import {
  loadMlbResearchOutcomesByDate,
  lookupMlbResearchOutcome,
} from "@/lib/research/load-mlb-game-research-outcomes";
import { attachKboOddsComparisonToGames } from "@/lib/games/attach-kbo-odds-comparison";
import { dedupeGameWithOddsItems } from "@/lib/games/unique-games";
import { loadFrozenBaseballSlate } from "@/lib/baseball/load-frozen-baseball-slate";
import { toBareGameWithOdds, type GameWithOdds } from "@/types/game-with-odds";
import type { GameData } from "@/types/game";
import { getKstToday } from "@/lib/datetime/kst";

/**
 * GET /api/games?date=YYYY-MM-DD&sport=&league=
 *
 * 우선순위:
 * 1) primary research schedule freeze (KBO/NPB) — TheSportsDB 3건 제한 우회
 * 2) live SportsProvider / MLB API-Baseball / Football
 * 3) Odds complement — freeze 없는 리그만
 *
 * File-system freeze artifact를 읽으므로 static 고정 응답 금지.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProviderMeta = {
  ok: boolean;
  count: number;
  error?: string;
};

type SlateDebugCounts = {
  frozenKbo: number;
  frozenNpbRaw: number;
  frozenNpbUnique: number;
  liveSportsAfterFilter: number;
  beforeLeagueFilter: number;
  afterLeagueFilter: number;
  finalKbo: number;
  finalNpb: number;
  usedFrozenKbo: boolean;
  usedFrozenNpb: boolean;
  skippedLiveTheSportsDb: boolean;
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
  const wantedLeague = league?.trim().toUpperCase() ?? null;
  const canQueryMlb =
    validDate &&
    wantBaseball &&
    (!wantedLeague || wantedLeague === "MLB");

  const canQueryFootball =
    !!date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    sport !== "baseball" &&
    sport !== "basketball";

  // Frozen research slate first (no Provider / Odds API)
  let frozenMeta: Awaited<ReturnType<typeof loadFrozenBaseballSlate>>["meta"] | null =
    null;
  let frozenGames: GameData[] = [];
  let usedFrozenKbo = false;
  let usedFrozenNpb = false;
  if (wantBaseball && validDate) {
    try {
      const frozen = await loadFrozenBaseballSlate({
        dateKst,
        league: wantedLeague,
      });
      frozenMeta = frozen.meta;
      frozenGames = frozen.games;
      usedFrozenKbo = frozen.meta.usedFrozenKbo;
      usedFrozenNpb = frozen.meta.usedFrozenNpb;
    } catch {
      frozenMeta = null;
      frozenGames = [];
    }
  }

  // Skip TheSportsDB when freeze covers all requested KBO/NPB
  const needLiveKbo =
    wantBaseball &&
    (!wantedLeague || wantedLeague === "KBO") &&
    !usedFrozenKbo;
  const needLiveNpb =
    wantBaseball &&
    (!wantedLeague || wantedLeague === "NPB") &&
    !usedFrozenNpb;
  const needLiveTheSportsDb = needLiveKbo || needLiveNpb;
  const liveSportsLeague =
    needLiveKbo && needLiveNpb
      ? undefined
      : needLiveKbo
        ? "KBO"
        : needLiveNpb
          ? "NPB"
          : undefined;

  const [sportsSettled, mlbSettled, footballSettled] =
    await Promise.allSettled([
      needLiveTheSportsDb
        ? getSportsProvider().getGames({
            date,
            sport: "baseball",
            league: liveSportsLeague ?? league,
          })
        : Promise.resolve([] as GameData[]),
      canQueryMlb ? getMlbGamesForDate(dateKst) : Promise.resolve(null),
      canQueryFootball
        ? getFootballGamesForDate(date)
        : Promise.resolve(null),
    ]);

  const sportsMeta: ProviderMeta = { ok: false, count: 0 };
  let sportsGames: GameData[] = [];

  if (!needLiveTheSportsDb) {
    sportsMeta.ok = true;
    sportsMeta.count = 0;
  } else if (sportsSettled.status === "fulfilled") {
    sportsGames = sportsSettled.value.filter((g) => {
      const lg = g.league.toUpperCase();
      if (lg === "KBO" && usedFrozenKbo) return false;
      if (lg === "NPB" && usedFrozenNpb) return false;
      return true;
    });
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

  const frozenOk = frozenGames.length > 0;
  const anySourceSucceeded =
    sportsMeta.ok ||
    frozenOk ||
    (!mlbMeta.skipped && mlbMeta.ok) ||
    (!footballMeta.skipped && footballMeta.ok);

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
            frozenBaseballSlate: frozenMeta,
          },
        },
        message: "경기 일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 502 },
    );
  }

  let baseballComplementMeta: Awaited<
    ReturnType<typeof complementBaseballScheduleWithOdds>
  >["meta"] | null = null;

  let combinedSportsGames = [
    ...frozenGames,
    ...sportsGames,
    ...mlbGames,
  ];

  if (wantBaseball && (sportsMeta.ok || mlbMeta.ok || frozenOk)) {
    const baseballPrimary = combinedSportsGames.filter(
      (g) => g.sport === "baseball",
    );
    const nonBaseballSports = combinedSportsGames.filter(
      (g) => g.sport !== "baseball",
    );
    const complementLeagues: Array<"KBO" | "NPB" | "MLB"> = [];
    // Freeze가 있으면 Odds complement(API) 스킵 — artifact 전체 slate 유지
    if (
      !usedFrozenKbo &&
      sportsMeta.ok &&
      (!wantedLeague || wantedLeague === "KBO")
    ) {
      complementLeagues.push("KBO");
    }
    if (
      !usedFrozenNpb &&
      sportsMeta.ok &&
      (!wantedLeague || wantedLeague === "NPB")
    ) {
      complementLeagues.push("NPB");
    }
    if (mlbMeta.ok && (!wantedLeague || wantedLeague === "MLB")) {
      complementLeagues.push("MLB");
    }
    if (complementLeagues.length > 0) {
      try {
        const complemented = await complementBaseballScheduleWithOdds(
          baseballPrimary,
          dateKst,
          complementLeagues,
        );
        baseballComplementMeta = complemented.meta;
        combinedSportsGames = [...nonBaseballSports, ...complemented.games];
      } catch {
        baseballComplementMeta = null;
      }
    }
  }

  let games = mergeGames(combinedSportsGames, footballGames);
  const beforeLeagueFilter = games.length;

  if (sport !== "all") {
    games = games.filter((g) => g.sport === sport);
  }
  if (league) {
    const wanted = league.toLowerCase();
    games = games.filter((g) => g.league.toLowerCase() === wanted);
  }
  games = sortGames(games);
  const afterLeagueFilter = games.length;

  // Live Odds API: skip frozen KBO/NPB (research comparison attaches separately)
  const skipLiveOdds = (g: GameData) => {
    const lg = g.league.toUpperCase();
    return (lg === "KBO" && usedFrozenKbo) || (lg === "NPB" && usedFrozenNpb);
  };
  const liveOddsGames = games.filter((g) => !skipLiveOdds(g));
  const frozenOddsGames = games.filter((g) => skipLiveOdds(g));

  let items: GameWithOdds[] = [];
  let oddsMeta: OddsEnrichmentMeta;
  try {
    if (liveOddsGames.length > 0) {
      const enriched = await attachOddsToGames(liveOddsGames);
      items = [
        ...enriched.items,
        ...frozenOddsGames.map(toBareGameWithOdds),
      ];
      oddsMeta = enriched.meta;
    } else {
      items = games.map(toBareGameWithOdds);
      oddsMeta = buildProviderErrorOddsResult([]).meta;
      oddsMeta = {
        ...oddsMeta,
        // mark as skipped for frozen-only days
      };
    }
  } catch {
    const fallback = buildProviderErrorOddsResult(games);
    items = fallback.items;
    oddsMeta = fallback.meta;
  }

  try {
    items = await attachRecommendationGrades(items);
  } catch {
    // keep null recommendations
  }

  if (date) {
    try {
      const outcomes = await loadMlbResearchOutcomesByDate(date);
      if (outcomes.size > 0) {
        items = items.map((item) => {
          const hit = lookupMlbResearchOutcome(outcomes, item.game);
          if (!hit) return item;
          return {
            ...item,
            researchOutcome: {
              homeScore: hit.homeScore,
              awayScore: hit.awayScore,
              homeTeam: hit.homeTeam,
              awayTeam: hit.awayTeam,
              predictedTeam: hit.predictedTeam,
              predictionHit: hit.predictionHit,
            },
          };
        });
      }
    } catch {
      // soft fail
    }
  }

  if (date) {
    try {
      items = await attachKboOddsComparisonToGames(items, date);
    } catch {
      // soft fail
    }
  }

  items = dedupeGameWithOddsItems(items);
  {
    const order = new Map(
      sortGames(items.map((i) => i.game)).map((g, idx) => [g.id, idx]),
    );
    items = [...items].sort(
      (a, b) => (order.get(a.game.id) ?? 0) - (order.get(b.game.id) ?? 0),
    );
  }

  const partial =
    (needLiveTheSportsDb && !sportsMeta.ok) ||
    (!mlbMeta.skipped && !mlbMeta.ok) ||
    (!footballMeta.skipped && !footballMeta.ok);

  const finalKbo = items.filter((i) => i.game.league.toUpperCase() === "KBO")
    .length;
  const finalNpb = items.filter((i) => i.game.league.toUpperCase() === "NPB")
    .length;

  const slateDebug: SlateDebugCounts = {
    frozenKbo: frozenMeta?.kboUniqueCount ?? 0,
    frozenNpbRaw: frozenMeta?.npbRawCount ?? 0,
    frozenNpbUnique: frozenMeta?.npbUniqueCount ?? 0,
    liveSportsAfterFilter: sportsMeta.count,
    beforeLeagueFilter,
    afterLeagueFilter,
    finalKbo,
    finalNpb,
    usedFrozenKbo,
    usedFrozenNpb,
    skippedLiveTheSportsDb: !needLiveTheSportsDb,
  };

  return NextResponse.json(
    {
      games: items,
      meta: {
        status: partial ? "partial" : "success",
        date: date ?? null,
        dateKstResolved: dateKst,
        sources: {
          sports: sportsMeta,
          apiBaseballMlb: mlbMeta,
          football: footballMeta,
          frozenBaseballSlate: frozenMeta,
        },
        baseballScheduleComplement: baseballComplementMeta,
        odds: oddsMeta,
        ...(process.env.NODE_ENV === "development"
          ? { slateDebug }
          : {}),
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

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
