"use client";

import { useEffect, useMemo, useState } from "react";
import type { SportFilter } from "@/types/game";
import type { GameWithOdds } from "@/types/game-with-odds";
import { getKstToday } from "@/lib/datetime/kst";
import { formatKoreanDate } from "@/lib/games/group";
import {
  getMatchDisplayLabel,
  getTeamDisplayName,
} from "@/lib/teams";
import Card from "@/components/ui/Card";
import SearchBar from "./SearchBar";
import DatePicker from "./DatePicker";
import LeagueFilter from "./LeagueFilter";
import GameList from "./GameList";

type LoadState = "loading" | "success" | "empty" | "error";

type GamesApiResponse = {
  games: GameWithOdds[];
  meta?: {
    status?: "success" | "partial" | "error";
    sources?: Record<string, { ok: boolean; count: number; error?: string }>;
  };
};

function filterItems(
  items: GameWithOdds[],
  search: string,
  sport: SportFilter,
): GameWithOdds[] {
  const query = search.trim().toLowerCase();

  return items.filter(({ game }) => {
    if (sport !== "all" && game.sport !== sport) return false;
    if (!query) return true;

    const searchable = [
      game.league,
      game.homeTeam,
      game.awayTeam,
      getTeamDisplayName(game.homeTeam),
      getTeamDisplayName(game.awayTeam),
      getMatchDisplayLabel(game.homeTeam, game.awayTeam),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
}

export default function GamesPageContent() {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => getKstToday());
  const [sport, setSport] = useState<SportFilter>("all");

  const [items, setItems] = useState<GameWithOdds[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    fetch(`/api/games?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as GamesApiResponse;
        // 두 일정 Provider 모두 실패한 경우만 오류 (partial 은 표시)
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Array.isArray(body.games) ? body.games : [];
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setState(data.length === 0 ? "empty" : "success");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  const filteredItems = useMemo(
    () => filterItems(items, search, sport),
    [items, search, sport],
  );

  const showCount = state === "success" || state === "empty";
  const headerCount =
    state === "success"
      ? filteredItems.length
      : state === "empty"
        ? 0
        : null;

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
      </div>

      <div className="mt-8">
        {showCount && headerCount !== null && (
          <div className="mb-4">
            <p className="text-sm text-zinc-400">
              <span className="font-medium text-zinc-200">
                {formatKoreanDate(date)}
              </span>
              <span className="mx-1.5 text-zinc-600">·</span>
              <span className="tabular-nums text-zinc-300">
                {headerCount}경기
              </span>
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

  if (state === "empty" || items.length === 0) {
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

  return <GameList items={items} />;
}
