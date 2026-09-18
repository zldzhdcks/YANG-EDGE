import type { AnalysisPresentationIdentity } from "@/lib/datetime/games-date";
import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

/**
 * Fill NULL presentation fields from list metadata.
 * Never overwrites authoritative resolved identity. Never changes dateKst.
 * List identity is not a research join key.
 */
export function applyListIdentityFallback(
  view: PublicGameAnalysisViewV1,
  listIdentity?: AnalysisPresentationIdentity | null,
): PublicGameAnalysisViewV1 {
  if (!listIdentity) return view;
  const game = { ...view.game };
  if (!game.sport && listIdentity.sport) game.sport = listIdentity.sport;
  if (!game.league && listIdentity.league) game.league = listIdentity.league;
  if (!game.homeTeam && listIdentity.homeTeam) {
    game.homeTeam = listIdentity.homeTeam;
  }
  if (!game.awayTeam && listIdentity.awayTeam) {
    game.awayTeam = listIdentity.awayTeam;
  }
  if (!game.startTimeKst && listIdentity.startTime) {
    game.startTimeKst = listIdentity.startTime;
  }
  return { ...view, game };
}
