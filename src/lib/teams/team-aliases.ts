import type { TeamAliasEntry } from "./types";

/**
 * 팀 한글 별칭 테이블.
 *
 * 우선 작성: K리그1 · KBO · NPB · MLB · MLS
 * 이후 확장: 유럽 주요 리그
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
    originalNames: ["Kia Tigers", "KIA Tigers", "KIA", "KIA 타이거즈", "기아", "기아 타이거즈"],
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
    originalNames: ["KT Wiz", "KT Wiz Suwon", "kt wiz", "KT", "KT 위즈"],
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
      "Rakuten Gold. Eagles",
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
      "Fukuoka S. Hawks",
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

  // ─── MLB ───────────────────────────────────────────────
  // API-BASEBALL / Odds 원본명 기준. 짧아 교차 충돌 나는 도시명은 제외.
  {
    displayName: "애리조나 다이아몬드백스",
    originalNames: [
      "Arizona Diamondbacks",
      "Arizona D-backs",
      "ARI Diamondbacks",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "애슬레틱스",
    originalNames: [
      "Athletics",
      "Oakland Athletics",
      "Oakland A's",
      "A's",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "애틀랜타 브레이브스",
    originalNames: ["Atlanta Braves", "ATL Braves"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "볼티모어 오리올스",
    originalNames: ["Baltimore Orioles", "BAL Orioles"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "보스턴 레드삭스",
    originalNames: ["Boston Red Sox", "BOS Red Sox"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "시카고 컵스",
    originalNames: ["Chicago Cubs", "Chi Cubs", "CHC"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "시카고 화이트삭스",
    originalNames: [
      "Chicago White Sox",
      "Chi White Sox",
      "CWS",
      "CHW",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "신시내티 레즈",
    originalNames: ["Cincinnati Reds", "CIN Reds"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "클리블랜드 가디언스",
    originalNames: [
      "Cleveland Guardians",
      "Cleveland Indians",
      "CLE Guardians",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "콜로라도 로키스",
    originalNames: ["Colorado Rockies", "COL Rockies"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "디트로이트 타이거스",
    originalNames: ["Detroit Tigers", "DET Tigers"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "휴스턴 애스트로스",
    originalNames: ["Houston Astros", "HOU Astros"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "캔자스시티 로열스",
    originalNames: [
      "Kansas City Royals",
      "KC Royals",
      "KCR",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "LA 에인절스",
    originalNames: [
      "Los Angeles Angels",
      "LA Angels",
      "LAA",
      "Anaheim Angels",
      "California Angels",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "LA 다저스",
    originalNames: [
      "Los Angeles Dodgers",
      "LA Dodgers",
      "LAD",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "마이애미 말린스",
    originalNames: ["Miami Marlins", "MIA Marlins", "Florida Marlins"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "밀워키 브루어스",
    originalNames: ["Milwaukee Brewers", "MIL Brewers"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "미네소타 트윈스",
    originalNames: ["Minnesota Twins", "MIN Twins"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "뉴욕 메츠",
    originalNames: ["New York Mets", "NY Mets", "NYM"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "뉴욕 양키스",
    originalNames: ["New York Yankees", "NY Yankees", "NYY"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "필라델피아 필리스",
    originalNames: ["Philadelphia Phillies", "PHI Phillies"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "피츠버그 파이리츠",
    originalNames: ["Pittsburgh Pirates", "PIT Pirates"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "샌디에이고 파드리스",
    originalNames: ["San Diego Padres", "SD Padres", "SDP"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "샌프란시스코 자이언츠",
    originalNames: [
      "San Francisco Giants",
      "SF Giants",
      "SFG",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "시애틀 매리너스",
    originalNames: ["Seattle Mariners", "SEA Mariners"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "세인트루이스 카디널스",
    originalNames: [
      "St. Louis Cardinals",
      "St.Louis Cardinals",
      "Saint Louis Cardinals",
      "STL Cardinals",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "탬파베이 레이스",
    originalNames: [
      "Tampa Bay Rays",
      "Tampa Bay Devil Rays",
      "TB Rays",
    ],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "텍사스 레인저스",
    originalNames: ["Texas Rangers", "TEX Rangers"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "토론토 블루제이스",
    originalNames: ["Toronto Blue Jays", "TOR Blue Jays"],
    league: "MLB",
    sport: "baseball",
  },
  {
    displayName: "워싱턴 내셔널스",
    originalNames: [
      "Washington Nationals",
      "WAS Nationals",
      "WSH Nationals",
    ],
    league: "MLB",
    sport: "baseball",
  },

  // ─── MLS (2026-07-26 API-Football fixtures 실제 노출명 기준) ─
  {
    displayName: "애틀랜타 유나이티드",
    originalNames: ["Atlanta United FC", "Atlanta United"],
    externalIds: [{ provider: "api-football", id: "1608" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "오스틴 FC",
    originalNames: ["Austin", "Austin FC"],
    externalIds: [{ provider: "api-football", id: "16489" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "CF 몬트리올",
    originalNames: [
      "CF Montreal",
      "CF Montréal",
      "Montreal Impact",
      "Club de Foot Montreal",
    ],
    externalIds: [{ provider: "api-football", id: "1614" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "샬럿 FC",
    originalNames: ["Charlotte", "Charlotte FC"],
    externalIds: [{ provider: "api-football", id: "18310" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "시카고 파이어",
    originalNames: ["Chicago Fire", "Chicago Fire FC"],
    externalIds: [{ provider: "api-football", id: "1607" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "콜로라도 래피즈",
    originalNames: ["Colorado Rapids"],
    externalIds: [{ provider: "api-football", id: "1610" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "콜럼버스 크루",
    originalNames: ["Columbus Crew", "Columbus Crew SC"],
    externalIds: [{ provider: "api-football", id: "1613" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "DC 유나이티드",
    originalNames: ["DC United", "D.C. United"],
    externalIds: [{ provider: "api-football", id: "1615" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "FC 신시내티",
    originalNames: ["FC Cincinnati"],
    externalIds: [{ provider: "api-football", id: "2242" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "FC 댈러스",
    originalNames: ["FC Dallas"],
    externalIds: [{ provider: "api-football", id: "1597" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "휴스턴 다이너모",
    originalNames: ["Houston Dynamo", "Houston Dynamo FC"],
    externalIds: [{ provider: "api-football", id: "1600" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "인터 마이애미",
    originalNames: ["Inter Miami", "Inter Miami CF"],
    externalIds: [{ provider: "api-football", id: "9568" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "로스앤젤레스 FC",
    originalNames: ["Los Angeles FC", "LAFC"],
    externalIds: [{ provider: "api-football", id: "1616" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "LA 갤럭시",
    originalNames: ["Los Angeles Galaxy", "LA Galaxy"],
    externalIds: [{ provider: "api-football", id: "1605" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "미네소타 유나이티드",
    originalNames: ["Minnesota United FC", "Minnesota United"],
    externalIds: [{ provider: "api-football", id: "1612" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "내슈빌 SC",
    originalNames: ["Nashville SC", "Nashville"],
    externalIds: [{ provider: "api-football", id: "9569" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "뉴잉글랜드 레볼루션",
    originalNames: ["New England Revolution"],
    externalIds: [{ provider: "api-football", id: "1609" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "뉴욕 시티 FC",
    originalNames: ["New York City FC", "NYCFC", "New York City"],
    externalIds: [{ provider: "api-football", id: "1604" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "뉴욕 레드불스",
    originalNames: ["New York Red Bulls", "NY Red Bulls"],
    externalIds: [{ provider: "api-football", id: "1602" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "올랜도 시티",
    originalNames: ["Orlando City SC", "Orlando City"],
    externalIds: [{ provider: "api-football", id: "1598" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "필라델피아 유니언",
    originalNames: ["Philadelphia Union"],
    externalIds: [{ provider: "api-football", id: "1599" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "포틀랜드 팀버스",
    originalNames: ["Portland Timbers"],
    externalIds: [{ provider: "api-football", id: "1617" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "레알 솔트레이크",
    originalNames: ["Real Salt Lake"],
    externalIds: [{ provider: "api-football", id: "1606" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "샌디에이고 FC",
    originalNames: ["San Diego", "San Diego FC"],
    externalIds: [{ provider: "api-football", id: "25484" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "산호세 어스퀘이크스",
    originalNames: ["San Jose Earthquakes", "San José Earthquakes"],
    externalIds: [{ provider: "api-football", id: "1596" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "시애틀 사운더스",
    originalNames: ["Seattle Sounders", "Seattle Sounders FC"],
    externalIds: [{ provider: "api-football", id: "1595" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "스포팅 캔자스시티",
    originalNames: ["Sporting Kansas City", "Sporting KC"],
    externalIds: [{ provider: "api-football", id: "1611" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "세인트루이스 시티",
    originalNames: [
      "St. Louis City",
      "St. Louis City SC",
      "Saint Louis City SC",
    ],
    externalIds: [{ provider: "api-football", id: "20787" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "토론토 FC",
    originalNames: ["Toronto FC"],
    externalIds: [{ provider: "api-football", id: "1601" }],
    league: "MLS",
    sport: "football",
  },
  {
    displayName: "밴쿠버 화이트캡스",
    originalNames: [
      "Vancouver Whitecaps",
      "Vancouver Whitecaps FC",
    ],
    externalIds: [{ provider: "api-football", id: "1603" }],
    league: "MLS",
    sport: "football",
  },

  // ─── 유럽 주요 리그 (기존 시드 유지) ─────────────────────
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
