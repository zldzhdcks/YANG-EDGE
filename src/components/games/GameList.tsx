"use client";

import { useState } from "react";
import type { GameWithOdds } from "@/types/game-with-odds";
import Card from "@/components/ui/Card";
import {
  FULL_SLATE_LEAGUES,
  groupGamesByLeague,
  type LeagueGroup,
} from "@/lib/games/group";
import { getStableGameRenderKey } from "@/lib/games/unique-games";
import GameCard from "./GameCard";

type GameListProps = {
  items: GameWithOdds[];
  /** /games 목록 날짜 — 연구 보기 fromDate 전달용 */
  listDate?: string;
};

export default function GameList({ items, listDate }: GameListProps) {
  if (items.length === 0) {
    return (
      <Card padding="none" className="rounded-xl px-4 py-8 text-center">
        <p className="text-sm font-medium text-zinc-400">
          조건에 맞는 경기가 없습니다.
        </p>
      </Card>
    );
  }

  const groups = groupGamesByLeague(items);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <LeagueSection key={group.league} group={group} listDate={listDate} />
      ))}
    </div>
  );
}

function LeagueSection({
  group,
  listDate,
}: {
  group: LeagueGroup;
  listDate?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullSlate = FULL_SLATE_LEAGUES.has(group.league);
  const shown = fullSlate || expanded ? group.games : group.visibleGames;

  return (
    <section
      data-league={group.league}
      data-total-count={group.totalCount}
      data-visible-count={shown.length}
      data-rendered-count={shown.length}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-white">
          {group.league}
        </h2>
        <p className="text-xs tabular-nums text-zinc-500">
          {group.totalCount}경기
        </p>
      </div>

      <div className="border-t border-white/[0.06]">
        {shown.map((item) => (
          <GameCard
            key={item.game.id || getStableGameRenderKey(item.game)}
            game={item.game}
            odds={item.oddsMatch.matched ? item.odds : null}
            oddsComparison={item.oddsComparison ?? null}
            oddsAvailability={item.oddsAvailability}
            oddsUnavailableReason={item.oddsUnavailableReason}
            recommendation={item.recommendation ?? null}
            researchOutcome={item.researchOutcome ?? null}
            hideLeague
            fromDate={listDate}
            density="compact"
          />
        ))}
      </div>

      {!fullSlate && group.hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-lg border border-white/[0.08] py-2 text-sm font-medium text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          {group.hiddenCount}경기 더 보기
        </button>
      )}
    </section>
  );
}
