import type { GameData } from "@/types/game";
import type { GameWithOdds } from "@/types/game-with-odds";

function normalizeToken(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/[^a-z0-9가-힣]/g, "");
}

function identityKey(game: GameData): string {
  if (game.externalProvider && game.externalId) {
    return `${game.externalProvider}:${game.externalId}`;
  }
  return [
    normalizeToken(game.league),
    normalizeToken(game.homeTeam),
    normalizeToken(game.awayTeam),
    game.date,
    game.startTime,
  ].join("|");
}

function score(item: GameWithOdds): number {
  let total = 0;
  if (item.game.externalProvider && item.game.externalId) total += 100;
  if (item.game.externalProvider && item.game.externalProvider !== "the-odds-api") {
    total += 20;
  }
  if (item.oddsAvailability === "available") total += 10;
  if (item.researchOutcome) total += 5;
  if (item.game.aiAnalysisAvailable) total += 3;
  if (item.game.status && item.game.status !== "Not Started") total += 1;
  return total;
}

export function dedupeGameWithOddsItems(items: GameWithOdds[]): GameWithOdds[] {
  const byIdentity = new Map<string, GameWithOdds>();
  for (const item of items) {
    const key = identityKey(item.game);
    const current = byIdentity.get(key);
    if (!current || score(item) > score(current)) {
      byIdentity.set(key, item);
    }
  }
  return [...byIdentity.values()];
}

/**
 * /games 카드 React key — exact gameId 우선.
 * externalProvider만 있고 externalId가 비어 있으면(provider: "")로
 * 리그 전체가 동일 key가 되어 row가 사라질 수 있다.
 */
export function getStableGameRenderKey(game: GameData): string {
  if (game.id && game.id.trim() !== "") {
    return game.id;
  }
  if (game.externalProvider && game.externalId) {
    return `${game.league}|${game.externalProvider}|${game.externalId}`;
  }
  return `${game.league}|${normalizeToken(game.homeTeam)}|${normalizeToken(game.awayTeam)}|${game.date}|${game.startTime}`;
}
