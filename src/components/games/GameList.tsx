"use client";

import { useState } from "react";
import type { GameWithOdds } from "@/types/game-with-odds";
import Card from "@/components/ui/Card";
import { groupGamesByLeague, type LeagueGroup } from "@/lib/games/group";
import GameCard from "./GameCard";

type GameListProps = {
  items: GameWithOdds[];
};

export default function GameList({ items }: GameListProps) {
  if (items.length === 0) {
    return (
      <Card padding="none" className="rounded-xl px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-400">
          조건에 맞는 경기가 없습니다.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          검색어나 종목, 날짜를 변경해 보세요.
        </p>
      </Card>
    );
  }

  const groups = groupGamesByLeague(items);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <LeagueSection key={group.league} group={group} />
      ))}
    </div>
  );
}

function LeagueSection({ group }: { group: LeagueGroup }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? group.games : group.visibleGames;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-white">
          {group.league}
        </h2>
        <p className="text-xs text-zinc-500">{group.totalCount}경기</p>
      </div>

      <Card padding="none" className="rounded-xl px-4 sm:px-6">
        {shown.map((item) => (
          <GameCard
            key={item.game.id}
            game={item.game}
            odds={item.oddsMatch.matched ? item.odds : null}
            oddsAvailability={item.oddsAvailability}
            oddsUnavailableReason={item.oddsUnavailableReason}
            recommendation={item.recommendation ?? null}
            hideLeague
          />
        ))}
      </Card>

      {group.hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-lg border border-white/[0.08] py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-white"
        >
          {group.hiddenCount}경기 더 보기
        </button>
      )}
    </section>
  );
}
