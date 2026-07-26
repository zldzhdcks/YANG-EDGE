"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SportFilter } from "@/types/game";
import type { GameWithOdds } from "@/types/game-with-odds";
import { getKstToday } from "@/lib/datetime/kst";
import { buildGamesFilterSummary } from "@/lib/games/filter-summary";
import {
  DEFAULT_RECOMMENDATION_FILTER,
  countRecommendationFilters,
  filterGamesClientSide,
  readStoredRecommendationFilter,
  writeStoredRecommendationFilter,
  type RecommendationFilterId,
} from "@/lib/games/recommendation-filter";
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
    sources?: Record<string, { ok: boolean; count: number; error?: string }>;
  };
};

type LoadedGames = {
  date: string;
  items: GameWithOdds[];
  ok: boolean;
};

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
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => getKstToday());
  const [sport, setSport] = useState<SportFilter>("all");
  // SSR은 DEFAULT, 클라이언트는 localStorage (hydration 안전)
  const recommendation = useSyncExternalStore(
    subscribeRecommendationFilter,
    readStoredRecommendationFilter,
    getServerRecommendationFilter,
  );

  const [loaded, setLoaded] = useState<LoadedGames | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/games?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as GamesApiResponse;
        // 두 일정 Provider 모두 실패한 경우만 오류 (partial 은 표시)
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Array.isArray(body.games) ? body.games : [];
      })
      .then((data) => {
        if (cancelled) return;
        setLoaded({ date, items: data, ok: true });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ date, items: [], ok: false });
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          오늘 경기
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          경기를 선택하면 EDGE Detail로 이동합니다.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar value={search} onChange={setSearch} />
          <DatePicker value={date} onChange={setDate} />
        </div>

        <LeagueFilter value={sport} onChange={setSport} />
        <RecommendationFilter
          value={recommendation}
          onChange={handleRecommendationChange}
          counts={recommendationCounts}
        />
      </div>

      <div className="mt-8">
        {showSummary && (
          <div className="mb-4">
            <p className="text-sm leading-relaxed text-zinc-400">
              {filterSummary}
            </p>
          </div>
        )}

        <GamesResult state={state} items={filteredItems} />
      </div>
    </div>
  );
}

function GamesResult({
  state,
  items,
}: {
  state: LoadState;
  items: GameWithOdds[];
}) {
  if (state === "loading") {
    return (
      <Card padding="none" className="rounded-xl px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-400">
          경기 일정을 불러오는 중...
        </p>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card padding="none" className="rounded-xl px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-400">
          경기 일정을 불러오지 못했습니다.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          잠시 후 다시 시도해 주세요.
        </p>
      </Card>
    );
  }

  // 날짜에 경기가 아예 없을 때만 날짜 빈 상태
  if (state === "empty") {
    return (
      <Card padding="none" className="rounded-xl px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-400">
          선택한 날짜에 등록된 경기가 없습니다.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          다른 날짜나 종목을 선택해 보세요.
        </p>
      </Card>
    );
  }

  // 필터 결과 0건 → GameList 빈 안내 ("조건에 맞는 경기가 없습니다.")
  return <GameList items={items} />;
}
