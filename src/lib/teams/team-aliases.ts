import type { TeamAliasEntry } from "./types";

/**
 * 팀 한글 별칭 테이블.
 *
 * 우선 작성: K리그1 · KBO · NPB
 * 이후 확장: MLS · 유럽 주요 리그 (구조만 열어 둠)
 *
 * - externalIds: provider + id 최우선
 * - originalNames: ID 없을 때 이름 fallback
 */
export const TEAM_ALIASES: TeamAliasEntry[] = [
  // ─── KBO ───────────────────────────────────────────────
  {
    displayName: "두산",
    originalNames: ["Doosan Bears", "두산", "두산 베어스"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "삼성",
    originalNames: ["Samsung Lions", "삼성", "삼성 라이온즈"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "한화",
    originalNames: ["Hanwha Eagles", "한화", "한화 이글스"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "LG",
    originalNames: ["LG Twins", "LG", "LG 트윈스"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "KIA",
    originalNames: ["Kia Tigers", "KIA Tigers", "KIA", "기아", "기아 타이거즈"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "키움",
    originalNames: ["Kiwoom Heroes", "키움", "키움 히어로즈"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "SSG",
    originalNames: ["SSG Landers", "SSG", "SSG 랜더스"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "NC",
    originalNames: ["NC Dinos", "NC", "NC 다이노스"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "롯데",
    originalNames: ["Lotte Giants", "롯데", "롯데 자이언츠"],
    league: "KBO",
    sport: "baseball",
  },
  {
    displayName: "KT",
    originalNames: ["KT Wiz", "kt wiz", "KT", "KT 위즈"],
    league: "KBO",
    sport: "baseball",
  },

  // ─── NPB ───────────────────────────────────────────────
  {
    displayName: "주니치",
    originalNames: ["Chunichi Dragons", "주니치", "주니치 드래곤즈"],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "요코하마",
    originalNames: [
      "Yokohama DeNA BayStars",
      "Yokohama BayStars",
      "요코하마",
      "요코하마 DeNA",
    ],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "닛폰햄",
    originalNames: [
      "Hokkaido Nippon-Ham Fighters",
      "Nippon-Ham Fighters",
      "닛폰햄",
      "니혼햄",
    ],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "라쿠텐",
    originalNames: [
      "Tohoku Rakuten Golden Eagles",
      "Rakuten Golden Eagles",
      "라쿠텐",
    ],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "한신",
    originalNames: ["Hanshin Tigers", "한신", "한신 타이거스"],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "요미우리",
    originalNames: ["Yomiuri Giants", "요미우리", "요미우리 자이언츠"],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "소프트뱅크",
    originalNames: [
      "Fukuoka SoftBank Hawks",
      "SoftBank Hawks",
      "소프트뱅크",
      "소프트뱅크 호크스",
    ],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "오릭스",
    originalNames: ["Orix Buffaloes", "오릭스", "오릭스 버팔로스"],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "세이부",
    originalNames: ["Saitama Seibu Lions", "Seibu Lions", "세이부"],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "롯데",
    originalNames: ["Chiba Lotte Marines", "Lotte Marines", "치바 롯데"],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "히로시마",
    originalNames: ["Hiroshima Toyo Carp", "Hiroshima Carp", "히로시마"],
    league: "NPB",
    sport: "baseball",
  },
  {
    displayName: "야쿠르트",
    originalNames: ["Tokyo Yakult Swallows", "Yakult Swallows", "야쿠르트"],
    league: "NPB",
    sport: "baseball",
  },

  // ─── K리그1 (API-Football leagueId 292) ─────────────────
  // externalIds: api-football team id (이름 변동 대비 최우선)
  {
    displayName: "울산",
    originalNames: [
      "Ulsan HD",
      "Ulsan HD FC",
      "Ulsan Hyundai",
      "Ulsan Hyundai FC",
      "울산",
      "울산 HD",
    ],
    externalIds: [{ provider: "api-football", id: "2764" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "전북",
    originalNames: [
      "Jeonbuk Motors",
      "Jeonbuk Hyundai Motors",
      "Jeonbuk",
      "전북",
      "전북 현대",
    ],
    externalIds: [{ provider: "api-football", id: "2769" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "서울",
    originalNames: ["FC Seoul", "Seoul", "서울", "FC서울"],
    externalIds: [{ provider: "api-football", id: "2766" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "포항",
    originalNames: ["Pohang Steelers", "Pohang", "포항", "포항 스틸러스"],
    externalIds: [{ provider: "api-football", id: "2763" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "강원",
    originalNames: ["Gangwon FC", "Gangwon", "강원", "강원FC"],
    externalIds: [{ provider: "api-football", id: "2760" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "제주",
    originalNames: ["Jeju United", "Jeju United FC", "제주", "제주 유나이티드"],
    externalIds: [{ provider: "api-football", id: "2762" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "대구",
    originalNames: ["Daegu FC", "Daegu", "대구", "대구FC"],
    externalIds: [{ provider: "api-football", id: "2758" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "인천",
    originalNames: ["Incheon United", "Incheon", "인천", "인천 유나이티드"],
    externalIds: [{ provider: "api-football", id: "2761" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "광주",
    originalNames: ["Gwangju FC", "Gwangju", "광주", "광주FC"],
    externalIds: [{ provider: "api-football", id: "2765" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "대전",
    originalNames: [
      "Daejeon Citizen",
      "Daejeon Hana Citizen",
      "Daejeon",
      "대전",
      "대전 하나 시티즌",
    ],
    externalIds: [{ provider: "api-football", id: "2759" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "수원FC",
    originalNames: ["Suwon FC", "Suwon City", "수원FC", "수원 FC"],
    externalIds: [{ provider: "api-football", id: "2789" }],
    league: "K리그1",
    sport: "football",
  },
  {
    displayName: "김천",
    originalNames: [
      "Gimcheon Sangmu",
      "Gimcheon Sangmu FC",
      "Sangju Sangmu",
      "김천",
      "김천 상무",
    ],
    externalIds: [{ provider: "api-football", id: "7002" }],
    league: "K리그1",
    sport: "football",
  },

  // ─── 유럽·MLS (이후 확장용 — 소수 시드만) ───────────────
  {
    displayName: "아스널",
    originalNames: ["Arsenal", "Arsenal FC"],
    externalIds: [{ provider: "api-football", id: "42" }],
    league: "프리미어리그",
    sport: "football",
  },
  {
    displayName: "리버풀",
    originalNames: ["Liverpool", "Liverpool FC"],
    externalIds: [{ provider: "api-football", id: "40" }],
    league: "프리미어리그",
    sport: "football",
  },
  {
    displayName: "맨시티",
    originalNames: ["Manchester City", "Man City"],
    externalIds: [{ provider: "api-football", id: "50" }],
    league: "프리미어리그",
    sport: "football",
  },
  {
    displayName: "레알 마드리드",
    originalNames: ["Real Madrid", "Real Madrid CF"],
    externalIds: [{ provider: "api-football", id: "541" }],
    league: "라리가",
    sport: "football",
  },
  {
    displayName: "바르셀로나",
    originalNames: ["Barcelona", "FC Barcelona"],
    externalIds: [{ provider: "api-football", id: "529" }],
    league: "라리가",
    sport: "football",
  },
  {
    displayName: "바이에른",
    originalNames: ["Bayern Munich", "FC Bayern München", "Bayern München"],
    externalIds: [{ provider: "api-football", id: "157" }],
    league: "분데스리가",
    sport: "football",
  },
  {
    displayName: "인터 마이애미",
    originalNames: ["Inter Miami", "Inter Miami CF"],
    externalIds: [{ provider: "api-football", id: "9568" }],
    league: "MLS",
    sport: "football",
  },
];

/** ID 기준 매핑 슬롯 수 (externalIds 항목 합) */
export function countIdMappings(entries: TeamAliasEntry[] = TEAM_ALIASES): number {
  return entries.reduce((n, e) => n + (e.externalIds?.length ?? 0), 0);
}

/** 이름 기준 fallback 슬롯 수 (originalNames 항목 합) */
export function countNameFallbacks(
  entries: TeamAliasEntry[] = TEAM_ALIASES,
): number {
  return entries.reduce((n, e) => n + e.originalNames.length, 0);
}
