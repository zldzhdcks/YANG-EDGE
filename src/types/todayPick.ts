export type TodayPickData = {
  gameId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  aiWinRate: number;
  confidence: number;
  edgeValue: number;
  reasons: string[];
  /** 추천 팀 기준 정규화 시장 확률 (0~100). 야구 2-way + 배당 매칭 시에만. */
  marketProbability?: number | null;
  /** Value Edge (percentage points). 비교 불가면 null. */
  valueEdge?: number | null;
  /** 야구 2-way + 완전 배당 + 모델 비교 가능 시에만 true */
  comparisonAvailable?: boolean;
};

/** 홈·API용 Today EDGE Pick 로드 상태 (오류 ≠ 빈 추천) */
export type TodayPickLoadStatus =
  | "success"
  | "empty-games"
  | "empty-pick"
  | "error";

export type TodayPickLoadResult =
  | {
      status: "success";
      pick: TodayPickData;
      providerKind: "dummy" | "thesportsdb" | "apisports";
    }
  | {
      status: "empty-games";
      pick: null;
      providerKind: "dummy" | "thesportsdb" | "apisports";
    }
  | {
      status: "empty-pick";
      pick: null;
      providerKind: "dummy" | "thesportsdb" | "apisports";
    }
  | {
      status: "error";
      pick: null;
      providerKind: "dummy" | "thesportsdb" | "apisports";
      message: string;
      /** 클라이언트용 HTTP 상태 (502/503). 민감정보 없음 */
      httpStatus: number;
    };
