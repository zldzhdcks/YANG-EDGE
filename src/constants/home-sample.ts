/**
 * Home / analysis surfaces that use DummyEngineAnalysisProvider.
 * Schedule (SportsProvider) is separate — do not label schedule-only rows with these.
 */
export const HOME_ENGINE_INPUT_MODE = "DUMMY_SAMPLE" as const;

export const SAMPLE_ANALYSIS_BADGE = "연구용 샘플 분석";
export const SAMPLE_ANALYSIS_NOT_LIVE = "실추천 아님";
export const SAMPLE_ANALYSIS_BANNER_BODY =
  "아래 EDGE 수치·등급·이유는 DummyEngineAnalysisProvider 샘플 입력입니다. 실제 Provider 일정과 분리되며, MLB 연구 채점·실추천과 연결되어 있지 않습니다.";
export const SAMPLE_ANALYSIS_CTA = "샘플 분석 보기";
export const SAMPLE_ANALYZED_COUNT_LABEL = "샘플 분석";
