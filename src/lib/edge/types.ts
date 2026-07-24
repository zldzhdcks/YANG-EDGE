/**
 * YANG EDGE Engine v1 — 결과 타입
 *
 * 규칙 기반(explainable)과 향후 ML 엔진이 동일 EdgeEngineResult를 공유한다.
 * UI는 이 타입만 소비하면 되며: engineId / version 으로 구현체를 구분한다.
 */

export type EdgeFactorKey =
  | "recentForm"
  | "homeAway"
  | "scoring"
  | "defense"
  | "leagueStanding"
  | "headToHead"
  | "rest"
  | "injuries"
  | "streak"
  | "startingPitcher";

export type EdgeFactorScores = Record<EdgeFactorKey, number>;

export type EdgeGrade = "S" | "A+" | "A" | "B" | "C";

/** pick 팀 기준 유리/중립/불리 */
export type FactorAdvantage = "advantage" | "neutral" | "disadvantage";

/** 영향력 등급 (|score| × importance) */
export type FactorImpactLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type EdgeReasonIcon =
  | "pitcher"
  | "form"
  | "home"
  | "offense"
  | "defense"
  | "standings"
  | "h2h"
  | "rest"
  | "injury"
  | "streak"
  | "default";

/**
 * 화면·로그에 쓰는 설명 가능 근거.
 * ML 엔진도 동일 스키마로 feature attribution을 채울 수 있다.
 */
export type EdgeReason = {
  title: string;
  description: string;
  /** factor score (-1~+1, 홈 기준). ML은 attribution 부호로 매핑 가능 */
  score: number;
  /** 가중치 / feature importance (0~100 스케일 권장) */
  importance: number;
  icon: EdgeReasonIcon;
  /** 선택 메타 — UI 미사용이어도 Engine·디버깅용 */
  factor?: EdgeFactorKey;
  impact?: FactorImpactLevel;
};

export type EdgeRisk = {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  category: "injury" | "lineup" | "data" | "other";
  teamId?: "home" | "away";
};

/**
 * factor 단위 인사이트 (impact 순 정렬용).
 * 예) startingPitcher { score: 0.82, importance: 20, impact: "HIGH" }
 */
export type EdgeFactorInsight = {
  key: EdgeFactorKey;
  label: string;
  /** -1~+1 (양수=홈 우세) */
  score: number;
  /** 가중치(importance) */
  importance: number;
  /** |score| × importance */
  impactValue: number;
  impact: FactorImpactLevel;
  /** 추천(pick) 팀 기준 */
  advantage: FactorAdvantage;
  available: boolean;
  icon: EdgeReasonIcon;
};

export type EdgeEngineId = "rule-v1" | "ml-v1" | (string & {});

export type EdgeEngineResult = {
  /** 스키마 버전 — UI/저장소 호환용 */
  version: "v1";
  /** 구현체 ID (rule-v1 | ml-v1 | …) */
  engineId: EdgeEngineId;

  pickTeamId: "home" | "away";
  pickTeamName: string;

  winProbability: number;
  /** alias 친화: edge === edgeScore */
  edgeScore: number;
  /** 0–100 */
  confidence: number;
  /**
   * 0–100. 설명이 투명할수록 높음.
   * 규칙 엔진은 일반적으로 높고, black-box ML은 낮게 둘 수 있다.
   */
  explainability: number;

  grade: EdgeGrade;
  label: string;

  reasons: EdgeReason[];
  risks: EdgeRisk[];

  /** 원시 factor 점수 맵 (호환·디버그) */
  factorScores: EdgeFactorScores;
  /** impact 내림차순 전체 factor */
  factors: EdgeFactorInsight[];
  /** 화면용 상위 4개 */
  topFactors: EdgeFactorInsight[];
};

export type FactorAvailability = Record<EdgeFactorKey, boolean>;
