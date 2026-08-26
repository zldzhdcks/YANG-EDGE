/**
 * Public presentation of sealed C states.
 * Internal C enum strings stay unchanged and must not appear in normal public UI.
 */

import type { PublicAnalysisState } from "@/types/public-game-analysis-view";

export type DailyCState =
  | "PREDICTION"
  | "PASS_REQUIRED_INPUT_MISSING"
  | "PASS_IDENTITY_REVIEW_REQUIRED"
  | "PASS_PROVIDER_NOT_SUPPORTED"
  | "PASS_MISSED_PRE_GAME_WINDOW"
  | "PASS_ENGINE_NOT_APPROVED"
  | "PASS_OTHER_EXPLICIT_REASON";

export type PublicCStateCopy = {
  state: PublicAnalysisState;
  headline: string;
  description: string;
};

const C_STATE_COPY: Record<DailyCState, PublicCStateCopy> = {
  PREDICTION: {
    state: "YANG_EDGE_ANALYSIS",
    headline: "YANG EDGE 분석",
    description: "이 경기의 공식 승패 분석입니다.",
  },
  PASS_ENGINE_NOT_APPROVED: {
    state: "OFFICIAL_PREDICTION_DEFERRED",
    headline: "공식 승패 분석 보류",
    description:
      "현재 검증을 마친 확률 모델이 없어 승패 확률은 제공하지 않습니다.",
  },
  PASS_IDENTITY_REVIEW_REQUIRED: {
    state: "ANALYSIS_PREPARING",
    headline: "경기 분석 준비 중",
    description: "이 경기의 분석 정보를 확인하고 있습니다.",
  },
  PASS_PROVIDER_NOT_SUPPORTED: {
    state: "ANALYSIS_EXPANDING",
    headline: "현재 분석 준비 중",
    description: "이 종목은 현재 분석 지원 범위를 확대하고 있습니다.",
  },
  PASS_MISSED_PRE_GAME_WINDOW: {
    state: "PREGAME_ANALYSIS_UNAVAILABLE",
    headline: "사전 분석 미제공",
    description:
      "경기 시작 전 검증된 분석이 확정되지 않아 사전 분석을 표시하지 않습니다.",
  },
  PASS_REQUIRED_INPUT_MISSING: {
    state: "ANALYSIS_PREPARING",
    headline: "경기 분석 준비 중",
    description: "이 경기의 분석 정보를 확인하고 있습니다.",
  },
  PASS_OTHER_EXPLICIT_REASON: {
    state: "ANALYSIS_PREPARING",
    headline: "경기 분석 준비 중",
    description: "이 경기의 분석 정보를 확인하고 있습니다.",
  },
};

export function isDailyCState(raw: string): raw is DailyCState {
  return Object.prototype.hasOwnProperty.call(C_STATE_COPY, raw);
}

export function publicCopyForCState(raw: string | null | undefined): PublicCStateCopy {
  if (raw && isDailyCState(raw)) return C_STATE_COPY[raw];
  return {
    state: "ANALYSIS_PREPARING",
    headline: "경기 분석 준비 중",
    description: "이 경기의 분석 정보를 확인하고 있습니다.",
  };
}
