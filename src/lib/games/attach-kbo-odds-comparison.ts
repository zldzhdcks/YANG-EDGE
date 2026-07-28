import { resolveKboTeamIdentity } from "@/lib/kbo/resolve-kbo-team-identity";
import { loadKboOddsComparisonDocument } from "@/lib/kbo/odds-comparison/load-kbo-odds-comparison";
import type { GameWithOdds } from "@/types/game-with-odds";

function getOdds(row: {
  domestic?: { selections?: Array<{ selectionCode: string; odds: number }> } | null;
  overseas?: { selections?: Array<{ selectionCode: string; odds: number }> } | null;
}, source: "domestic" | "overseas", side: "HOME" | "AWAY"): number | null {
  return row[source]?.selections?.find((selection) => selection.selectionCode === side)?.odds ?? null;
}

function buildGameMatchKey(args: {
  dateKst: string;
  startTimeKst: string | null;
  homeCanonicalTeamId: string | null;
  awayCanonicalTeamId: string | null;
}): string | null {
  if (!args.startTimeKst || !args.homeCanonicalTeamId || !args.awayCanonicalTeamId) {
    return null;
  }
  return `${args.dateKst}|${args.startTimeKst}|${args.homeCanonicalTeamId}|${args.awayCanonicalTeamId}`;
}

export async function attachKboOddsComparisonToGames(
  items: GameWithOdds[],
  dateKst: string,
): Promise<GameWithOdds[]> {
  const document = await loadKboOddsComparisonDocument(dateKst);
  if (!document || document.meta.dateKst !== dateKst) return items;

  const byKey = new Map(
    document.rows.map((row) => [
      buildGameMatchKey({
        dateKst: row.dateKst,
        startTimeKst: row.startTimeKst,
        homeCanonicalTeamId: resolveKboTeamIdentity(row.homeTeam).canonicalTeamId,
        awayCanonicalTeamId: resolveKboTeamIdentity(row.awayTeam).canonicalTeamId,
      }),
      row,
    ]),
  );

  return items.map((item) => {
    if (item.game.league !== "KBO") return item;
    const matchKey = buildGameMatchKey({
      dateKst: item.game.date,
      startTimeKst: `${item.game.date}T${item.game.startTime.slice(0, 5)}:00+09:00`,
      homeCanonicalTeamId: resolveKboTeamIdentity(item.game.homeTeam).canonicalTeamId,
      awayCanonicalTeamId: resolveKboTeamIdentity(item.game.awayTeam).canonicalTeamId,
    });
    if (!matchKey) return item;
    const row = byKey.get(matchKey);
    if (!row) {
      return {
        ...item,
        oddsComparison: {
          domestic: null,
          overseas: null,
          comparisonStatus: "DOMESTIC_MISSING",
        },
      };
    }
    return {
      ...item,
      oddsComparison: {
        domestic: row.domestic
          ? {
              homeOdds: getOdds(row, "domestic", "HOME"),
              awayOdds: getOdds(row, "domestic", "AWAY"),
              reviewStatus: row.domestic.reviewStatus,
              sourceLabel: "국내 프로토",
            }
          : null,
        overseas: row.overseas
          ? {
              homeOdds: getOdds(row, "overseas", "HOME"),
              awayOdds: getOdds(row, "overseas", "AWAY"),
              providerLabel: "The Odds API",
            }
          : null,
        comparisonStatus:
          row.comparison.status === "MARKET_RULE_UNVERIFIED"
            ? "MARKET_RULE_UNVERIFIED"
            : row.domestic == null
              ? "DOMESTIC_MISSING"
              : row.overseas == null
                ? "OVERSEAS_MISSING"
                : "COMPARABLE",
      },
    };
  });
}
