"use client";

import { useMemo, useState } from "react";
import type { GameData, SportFilter } from "@/types/game";
import { getMatchLabel } from "@/types/game";
import { DEFAULT_GAME_DATE } from "@/constants/games";
import SearchBar from "./SearchBar";
import DatePicker from "./DatePicker";
import LeagueFilter from "./LeagueFilter";
import GameList from "./GameList";

type GamesPageContentProps = {
  games: GameData[];
};

function filterGames(
  games: GameData[],
  search: string,
  date: string,
  sport: SportFilter,
): GameData[] {
  const query = search.trim().toLowerCase();

  return games.filter((game) => {
    if (game.date !== date) return false;
    if (sport !== "all" && game.sport !== sport) return false;
    if (!query) return true;

    const searchable = [
      game.league,
      game.homeTeam,
      game.awayTeam,
      getMatchLabel(game),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
}

export default function GamesPageContent({ games }: GamesPageContentProps) {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(DEFAULT_GAME_DATE);
  const [sport, setSport] = useState<SportFilter>("all");

  const filteredGames = useMemo(
    () => filterGames(games, search, date, sport),
    [games, search, date, sport],
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
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            <span className="font-medium text-zinc-300">
              {filteredGames.length}
            </span>
            경기
          </p>
        </div>
        <GameList games={filteredGames} />
      </div>
    </div>
  );
}
