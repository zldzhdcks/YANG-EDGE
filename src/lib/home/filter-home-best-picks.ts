import type {
  TodayEdgePick,
  TodayEdgePickSelectionResult,
} from "@/types/today-edge-pick";

/** Home BEST PICK cap. Do not pad empty slots. */
export const HOME_BEST_PICK_MAX = 3;

/**
 * Home consumer filter over the existing TODAY EDGE PICK loader.
 *
 * Official home BEST PICK = pickTier EDGE_PICK only.
 * RESEARCH_CANDIDATE is not a BEST PICK. PASS is never promoted.
 * Does not re-run Prediction / Engine / Result.
 */
export function filterHomeBestPicks(
  result: TodayEdgePickSelectionResult | null,
): TodayEdgePick[] {
  if (!result) return [];

  return result.picks
    .filter((pick) => pick.pickTier === "EDGE_PICK")
    .slice(0, HOME_BEST_PICK_MAX);
}
