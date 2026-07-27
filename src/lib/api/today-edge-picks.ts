import "server-only";

import { loadTodayEdgePickInputs } from "@/lib/edge/load-today-edge-pick-inputs";
import { selectTodayEdgePicks } from "@/lib/edge/select-today-edge-picks";
import type {
  EdgeSlateStatus,
  TodayEdgePickSelectionResult,
  TodayEdgePicksLoadResult,
} from "@/types/today-edge-pick";

export type LoadTodayEdgePicksOptions = {
  /** verification script 전용 — runtime 홈/API에서는 사용하지 않는다 */
  forceDateKst?: string;
  now?: Date;
};

function emptyResult(
  generatedAt: string,
  slateStatus: EdgeSlateStatus,
  nextScheduledDateKst: string | null,
): TodayEdgePickSelectionResult {
  return {
    meta: {
      targetDateKst: "",
      generatedAt,
      slateStatus,
      nextScheduledDateKst,
      candidateCount: 0,
      selectedCount: 0,
      strictSelectedCount: 0,
      researchCandidateCount: 0,
      selectionMode: "EMPTY",
      excludedCount: 0,
      strictExclusionCounts: {},
      predictionHashSha256: null,
    },
    picks: [],
    excluded: [],
  };
}

export async function loadTodayEdgePicks(
  options: LoadTodayEdgePicksOptions = {},
): Promise<TodayEdgePicksLoadResult> {
  try {
    const generatedAt = new Date().toISOString();
    const loaded = await loadTodayEdgePickInputs({
      forceDateKst: options.forceDateKst,
      now: options.now,
    });

    if (!loaded) {
      return {
        status: "empty",
        message: "오늘 MLB 연구 예측 스냅샷이 없습니다.",
        result: emptyResult(generatedAt, "NO_UPCOMING_SNAPSHOT", null),
      };
    }

    if (loaded.slateStatus === "NO_UPCOMING_SNAPSHOT") {
      return {
        status: "empty",
        message: "다음 경기 분석을 준비 중입니다.",
        result: emptyResult(
          generatedAt,
          "NO_UPCOMING_SNAPSHOT",
          loaded.nextScheduledDateKst,
        ),
      };
    }

    const selection = selectTodayEdgePicks(
      loaded.candidates,
      generatedAt,
      3,
      options.now?.getTime(),
    );

    const slateStatus: EdgeSlateStatus =
      selection.picks.length > 0 ? "UPCOMING" : "NO_ELIGIBLE_PICKS";

    const result: TodayEdgePickSelectionResult = {
      meta: {
        targetDateKst: loaded.dateKst,
        generatedAt,
        slateStatus,
        nextScheduledDateKst: loaded.nextScheduledDateKst,
        candidateCount: selection.candidateCount,
        selectedCount: selection.picks.length,
        strictSelectedCount: selection.strictSelectedCount,
        researchCandidateCount: selection.researchCandidateCount,
        selectionMode: selection.selectionMode,
        excludedCount: selection.excluded.length,
        strictExclusionCounts: selection.strictExclusionCounts,
        predictionHashSha256: loaded.predictionHashSha256,
      },
      picks: selection.picks,
      excluded: selection.excluded,
    };

    if (selection.picks.length === 0) {
      return {
        status: "empty",
        message: "선정된 EDGE PICK이 없습니다.",
        result,
      };
    }

    return {
      status: "success",
      result,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "TODAY EDGE PICK을 불러오지 못했습니다.",
    };
  }
}
