/**
 * YANG EDGE — 팀명 표시(한글화) 계층 타입.
 *
 * Provider / Odds / gameId 는 원본명(originalName)을 유지하고,
 * UI 표시 단계에서만 displayName 을 조회한다.
 */

/** 팀 ID 를 발행하는 외부 Provider (GameData.externalProvider 와 호환) */
export type TeamDataProvider =
  | "thesportsdb"
  | "api-football"
  | "api-baseball"
  | "apisports"
  | "the-odds-api"
  | "dummy";

/** 확장용 리그 태그 — MLS·유럽 리그는 이후 항목만 추가하면 된다. */
export type TeamLeagueTag =
  | "KBO"
  | "NPB"
  | "MLB"
  | "K리그1"
  | "J1리그"
  | "MLS"
  | "프리미어리그"
  | "라리가"
  | "분데스리가"
  | "세리에 A"
  | "리그 1"
  | "UEFA 챔피언스리그"
  | "UEFA 유로파리그"
  | "에레디비시에"
  | "EFL 챔피언십"
  | "기타";

export type TeamAliasEntry = {
  /** UI에 표시할 이름 (한글 우선) */
  displayName: string;
  /**
   * API / Odds / Dummy 원문 팀명.
   * 정규화 후 이름 기준 fallback 매핑에 사용.
   */
  originalNames: string[];
  /**
   * provider + externalTeamId 최우선 매핑.
   * GameData에 팀 ID가 실릴 때 이름 변동에 강하다.
   */
  externalIds?: Array<{
    provider: TeamDataProvider;
    id: string;
  }>;
  league?: TeamLeagueTag;
  sport?: "football" | "baseball" | "basketball";
};

export type GetTeamDisplayNameInput = {
  /** API 원본 팀명 (필수) */
  originalName: string;
  /** 있으면 provider+id 매핑을 최우선 사용 */
  provider?: TeamDataProvider | string | null;
  externalTeamId?: string | number | null;
  /** 이름 충돌 시 종목으로 후보를 좁힌다 */
  sport?: "football" | "baseball" | "basketball" | null;
  /** 이름 충돌 시 리그로 후보를 좁힌다 */
  league?: TeamLeagueTag | string | null;
};
