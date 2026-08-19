"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SportFilter } from "@/types/game";
import type { GameWithOdds } from "@/types/game-with-odds";
import { getKstToday } from "@/lib/datetime/kst";
import {
  buildGamesPath,
  parseGamesDateParam,
} from "@/lib/datetime/games-date";
import {
  buildGamesFilterSummary,
  recommendationFilterSummaryLabel,
} from "@/lib/games/filter-summary";
import { groupGamesByLeague } from "@/lib/games/group";
import {
  DEFAULT_RECOMMENDATION_FILTER,
  countRecommendationFilters,
  filterGamesClientSide,
  readStoredRecommendationFilter,
  writeStoredRecommendationFilter,
  type RecommendationFilterId,
} from "@/lib/games/recommendation-filter";
import { cn } from "@/utils/cn";
import Card from "@/components/ui/Card";
import SearchBar from "./SearchBar";
import DatePicker from "./DatePicker";
import LeagueFilter from "./LeagueFilter";
import RecommendationFilter from "./RecommendationFilter";
import GameList from "./GameList";

type LoadState = "loading" | "success" | "empty" | "error";

type GamesApiResponse = {
  games: GameWithOdds[];
  meta?: {
    status?: "success" | "partial" | "error";
    sources?: Record<string, unknown>;
    slateDebug?: {
      finalKbo?: number;
      finalNpb?: number;
      usedFrozenKbo?: boolean;
      usedFrozenNpb?: boolean;
    };
  };
};

type FrozenSlateMeta = {
  kboUniqueCount?: number;
  npbUniqueCount?: number;
  usedFrozenKbo?: boolean;
  usedFrozenNpb?: boolean;
};

function readFrozenSlateMeta(
  meta: GamesApiResponse["meta"],
): FrozenSlateMeta | null {
  const raw = meta?.sources?.frozenBaseballSlate;
  if (!raw || typeof raw !== "object") return null;
  return raw as FrozenSlateMeta;
}

type LoadedGames = {
  date: string;
  items: GameWithOdds[];
  ok: boolean;
  usedFrozenSlate?: boolean;
};

function countLeague(items: GameWithOdds[], league: string): number {
  return items.filter((item) => item.game.league === league).length;
}

/**
 * Freeze-backed fuller slate 가 이미 있으면, 같은 date의 더 얇은 응답으로
 * KBO/NPB 목록을 덮어쓰지 않는다 (live 3건 overwrite 방지).
 */
export function shouldKeepPreviousGamesLoad(
  prev: LoadedGames | null,
  nextDate: string,
  nextItems: GameWithOdds[],
  usedFrozenSlate: boolean,
): boolean {
  if (!prev || !prev.ok || prev.date !== nextDate) return false;
  if (!prev.usedFrozenSlate && !usedFrozenSlate) return false;

  const prevKbo = countLeague(prev.items, "KBO");
  const prevNpb = countLeague(prev.items, "NPB");
  const nextKbo = countLeague(nextItems, "KBO");
  const nextNpb = countLeague(nextItems, "NPB");

  const shrinksKbo = nextKbo < prevKbo;
  const shrinksNpb = nextNpb < prevNpb;
  if (!shrinksKbo && !shrinksNpb) return false;

  // Only block shrink when previous load already had a meaningful full slate.
  return prevKbo >= 5 || prevNpb >= 6 || Boolean(prev.usedFrozenSlate);
}

const RECOMMENDATION_FILTER_EVENT = "yang-edge:recommendation-filter";

function subscribeRecommendationFilter(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(RECOMMENDATION_FILTER_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(RECOMMENDATION_FILTER_EVENT, onStoreChange);
  };
}

function getServerRecommendationFilter(): RecommendationFilterId {
  return DEFAULT_RECOMMENDATION_FILTER;
}

export default function GamesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = getKstToday();
  const dateFromUrl = parseGamesDateParam(searchParams.get("date"));

  const [search, setSearch] = useState("");
  const [date, setDate] = useState(dateFromUrl);
  const [sport, setSport] = useState<SportFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  // SSR은 DEFAULT, 클라이언트는 localStorage (hydration 안전)
  const recommendation = useSyncExternalStore(
    subscribeRecommendationFilter,
    readStoredRecommendationFilter,
    getServerRecommendationFilter,
  );

  const [loaded, setLoaded] = useState<LoadedGames | null>(null);

  useEffect(() => {
    const next = parseGamesDateParam(searchParams.get("date"));
    setDate((current) => (current === next ? current : next));
  }, [searchParams]);

  const setDateAndUrl = useCallback(
    (nextRaw: string) => {
      const next = parseGamesDateParam(nextRaw);
      setDate(next);
      router.push(buildGamesPath(next), { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/games?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as GamesApiResponse;
        // 두 일정 Provider 모두 실패한 경우만 오류 (partial 은 표시)
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const games = Array.isArray(body.games) ? body.games : [];
        const frozen = readFrozenSlateMeta(body.meta);
        const slate = body.meta?.slateDebug;
        const usedFrozenSlate = Boolean(
          frozen?.usedFrozenKbo ||
            frozen?.usedFrozenNpb ||
            slate?.usedFrozenKbo ||
            slate?.usedFrozenNpb,
        );
        return { games, usedFrozenSlate };
      })
      .then((payload) => {
        if (cancelled) return;
        setLoaded((prev) => {
          if (
            shouldKeepPreviousGamesLoad(
              prev,
              date,
              payload.games,
              payload.usedFrozenSlate,
            )
          ) {
            return prev;
          }
          return {
            date,
            items: payload.games,
            ok: true,
            usedFrozenSlate: payload.usedFrozenSlate,
          };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ date, items: [], ok: false, usedFrozenSlate: false });
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  function handleRecommendationChange(value: RecommendationFilterId) {
    writeStoredRecommendationFilter(value);
    window.dispatchEvent(new Event(RECOMMENDATION_FILTER_EVENT));
  }

  const state: LoadState =
    loaded === null || loaded.date !== date
      ? "loading"
      : !loaded.ok
        ? "error"
        : loaded.items.length === 0
          ? "empty"
          : "success";

  const items = useMemo(
    () =>
      loaded !== null && loaded.date === date && loaded.ok ? loaded.items : [],
    [loaded, date],
  );

  const filteredItems = useMemo(
    () =>
      filterGamesClientSide(items, {
        search,
        sport,
        recommendation,
      }),
    [items, search, sport, recommendation],
  );

  const recommendationCounts = useMemo(
    () => countRecommendationFilters(items, { search, sport }),
    [items, search, sport],
  );

  const showSummary = state === "success" || state === "empty";
  const resultCount =
    state === "success" || state === "empty" ? filteredItems.length : 0;

  const filterSummary = useMemo(
    () =>
      buildGamesFilterSummary({
        date,
        sport,
        recommendation,
        search,
        resultCount,
      }),
    [date, sport, recommendation, search, resultCount],
  );

  const pipelineDebug = useMemo(() => {
    const stateKbo = countLeague(items, "KBO");
    const stateNpb = countLeague(items, "NPB");
    const filteredKbo = countLeague(filteredItems, "KBO");
    const filteredNpb = countLeague(filteredItems, "NPB");
    const groups = groupGamesByLeague(filteredItems);
    const kboGroup = groups.find((g) => g.league === "KBO");
    const npbGroup = groups.find((g) => g.league === "NPB");
    return {
      date,
      apiFetchUrl: `/api/games?date=${encodeURIComponent(date)}`,
      state: { total: items.length, kbo: stateKbo, npb: stateNpb },
      filtered: {
        total: filteredItems.length,
        kbo: filteredKbo,
        npb: filteredNpb,
      },
      grouped: {
        kbo: kboGroup?.totalCount ?? 0,
        npb: npbGroup?.totalCount ?? 0,
        kboVisible: kboGroup?.visibleGames.length ?? 0,
        npbVisible: npbGroup?.visibleGames.length ?? 0,
      },
      usedFrozenSlate: loaded?.usedFrozenSlate ?? false,
    };
  }, [date, items, filteredItems, loaded?.usedFrozenSlate]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __YANG_EDGE_GAMES_DEBUG__?: unknown }).__YANG_EDGE_GAMES_DEBUG__ =
      pipelineDebug;
  }, [pipelineDebug]);

  const recommendationActive =
    recommendation !== DEFAULT_RECOMMENDATION_FILTER;
  const searchActive = search.trim().length > 0;
  const secondaryFilterActive = recommendationActive || searchActive;
  const secondaryFilterIndicator = [
    recommendationActive
      ? recommendationFilterSummaryLabel(recommendation)
      : null,
    searchActive ? "검색" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          오늘 경기
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          선택한 날짜의 경기와 분석 상태를 확인하세요.
        </p>
      </div>

      <div className="space-y-4">
        <DatePicker value={date} today={today} onChange={setDateAndUrl} />
        <LeagueFilter value={sport} onChange={setSport} />

        <div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            aria-label={
              secondaryFilterActive
                ? `필터, ${secondaryFilterIndicator} 적용 중`
                : "필터"
            }
            onClick={() => setFiltersOpen((open) => !open)}
            className={cn(
              "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              secondaryFilterActive
                ? "border-white/20 font-medium text-white"
                : "border-white/[0.08] font-medium text-zinc-400 hover:border-white/[0.14] hover:text-white",
            )}
          >
            <span>필터</span>
            {secondaryFilterActive && (
              <>
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-white"
                />
                <span className="min-w-0 text-zinc-300">
                  · {secondaryFilterIndicator}
                </span>
              </>
            )}
            <span className="text-zinc-500" aria-hidden="true">
              {filtersOpen ? "▴" : "▾"}
            </span>
          </button>

          <div id={filtersId} hidden={!filtersOpen} className="mt-3 space-y-3">
            <div>
              <p className="mb-1.5 text-xs text-zinc-500">팀 검색</p>
              <SearchBar value={search} onChange={setSearch} />
            </div>
            <div>
              <p className="mb-1.5 text-xs text-zinc-500">추천 상태</p>
              <RecommendationFilter
                value={recommendation}
                onChange={handleRecommendationChange}
                counts={recommendationCounts}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {showSummary && (
          <p className="mb-3 text-xs tabular-nums text-zinc-500">
            {filterSummary}
          </p>
        )}

        <GamesResult state={state} items={filteredItems} listDate={date} />
      </div>
    </div>
  );
}

function GamesResult({
  state,
  items,
  listDate,
}: {
  state: LoadState;
  items: GameWithOdds[];
  listDate: string;
}) {
  if (state === "loading") {
    return (
      <StatusMessage>경기 일정을 불러오는 중...</StatusMessage>
    );
  }

  if (state === "error") {
    return <StatusMessage>경기 일정을 불러오지 못했습니다.</StatusMessage>;
  }

  // 날짜에 경기가 아예 없을 때만 날짜 빈 상태
  if (state === "empty") {
    return (
      <StatusMessage>선택한 날짜에 등록된 경기가 없습니다.</StatusMessage>
    );
  }

  // 필터 결과 0건 → GameList 빈 안내 ("조건에 맞는 경기가 없습니다.")
  return <GameList items={items} listDate={listDate} />;
}

function StatusMessage({ children }: { children: string }) {
  return (
    <Card padding="none" className="rounded-xl px-4 py-8 text-center">
      <p className="text-sm font-medium text-zinc-400">{children}</p>
    </Card>
  );
}
