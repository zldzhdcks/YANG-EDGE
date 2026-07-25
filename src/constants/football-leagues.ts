/**
 * /games 에 노출할 관심 축구 리그 화이트리스트.
 *
 * API-Football 날짜 응답은 하루 수백 경기(예: 718)를 포함하므로
 * 서버에서 이 목록의 providerLeagueId 만 통과시킨다.
 * (리그별 API 반복 호출 금지 — 날짜 1회 응답을 필터링한다.)
 *
 * providerLeagueId 는 API-Football v3 league id.
 */

export type FootballLeagueConfig = {
  providerLeagueId: number;
  displayName: string;
  shortName: string;
  country: string;
  /** 낮을수록 먼저 표시 */
  priority: number;
  enabled: boolean;
};

export const FOOTBALL_LEAGUES: FootballLeagueConfig[] = [
  {
    providerLeagueId: 2,
    displayName: "UEFA 챔피언스리그",
    shortName: "UCL",
    country: "Europe",
    priority: 1,
    enabled: true,
  },
  {
    providerLeagueId: 3,
    displayName: "UEFA 유로파리그",
    shortName: "UEL",
    country: "Europe",
    priority: 2,
    enabled: true,
  },
  {
    providerLeagueId: 39,
    displayName: "프리미어리그",
    shortName: "EPL",
    country: "England",
    priority: 3,
    enabled: true,
  },
  {
    providerLeagueId: 140,
    displayName: "라리가",
    shortName: "LaLiga",
    country: "Spain",
    priority: 4,
    enabled: true,
  },
  {
    providerLeagueId: 78,
    displayName: "분데스리가",
    shortName: "BUN",
    country: "Germany",
    priority: 5,
    enabled: true,
  },
  {
    providerLeagueId: 135,
    displayName: "세리에 A",
    shortName: "SerieA",
    country: "Italy",
    priority: 6,
    enabled: true,
  },
  {
    providerLeagueId: 61,
    displayName: "리그 1",
    shortName: "L1",
    country: "France",
    priority: 7,
    enabled: true,
  },
  {
    providerLeagueId: 292,
    displayName: "K리그1",
    shortName: "K1",
    country: "South-Korea",
    priority: 8,
    enabled: true,
  },
  {
    providerLeagueId: 98,
    displayName: "J1리그",
    shortName: "J1",
    country: "Japan",
    priority: 9,
    enabled: true,
  },
  {
    providerLeagueId: 253,
    displayName: "MLS",
    shortName: "MLS",
    country: "USA",
    priority: 10,
    enabled: true,
  },
];

const BY_PROVIDER_ID = new Map(
  FOOTBALL_LEAGUES.map((l) => [l.providerLeagueId, l]),
);

/** 활성 관심 리그만 */
export function getEnabledFootballLeagues(): FootballLeagueConfig[] {
  return FOOTBALL_LEAGUES.filter((l) => l.enabled);
}

/** 활성 관심 리그 providerLeagueId Set */
export function getEnabledFootballLeagueIds(): Set<number> {
  return new Set(getEnabledFootballLeagues().map((l) => l.providerLeagueId));
}

export function getFootballLeagueConfig(
  providerLeagueId: number,
): FootballLeagueConfig | null {
  return BY_PROVIDER_ID.get(providerLeagueId) ?? null;
}

/** displayName 으로 우선순위 조회 (그룹 정렬용) */
export function getFootballLeaguePriorityByName(
  displayName: string,
): number | null {
  const hit = FOOTBALL_LEAGUES.find((l) => l.displayName === displayName);
  return hit ? hit.priority : null;
}
