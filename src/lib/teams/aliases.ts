/**
 * TheSportsDB 등 외부 API 영문 팀명 → 화면용 한글 별칭.
 * 매핑이 없으면 원문을 그대로 반환한다.
 */
const TEAM_ALIASES: Record<string, string> = {
  // NPB
  "Chunichi Dragons": "주니치",
  "Yokohama DeNA BayStars": "요코하마",
  "Hokkaido Nippon-Ham Fighters": "닛폰햄",
  "Tohoku Rakuten Golden Eagles": "라쿠텐",
  "Hanshin Tigers": "한신",
  "Yomiuri Giants": "요미우리",
  "SoftBank Hawks": "소프트뱅크",
  "Fukuoka SoftBank Hawks": "소프트뱅크",
  "Orix Buffaloes": "오릭스",
  "Saitama Seibu Lions": "세이부",
  "Chiba Lotte Marines": "롯데",
  "Hiroshima Toyo Carp": "히로시마",
  "Tokyo Yakult Swallows": "야쿠르트",

  // KBO
  "Doosan Bears": "두산",
  "Samsung Lions": "삼성",
  "Hanwha Eagles": "한화",
  "LG Twins": "LG",
  "Kia Tigers": "KIA",
  "Kiwoom Heroes": "키움",
  "SSG Landers": "SSG",
  "NC Dinos": "NC",
  "Lotte Giants": "롯데",
  "KT Wiz": "KT",
};

/** 대소문자·공백 무시 조회용 키 */
function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const ALIAS_BY_NORMALIZED = new Map(
  Object.entries(TEAM_ALIASES).map(([en, ko]) => [normalizeKey(en), ko]),
);

/**
 * 화면 표시용 팀명.
 * 한글 별칭이 있으면 별칭, 없으면 API 원문.
 */
export function getDisplayTeamName(name: string): string {
  if (!name) return name;
  return ALIAS_BY_NORMALIZED.get(normalizeKey(name)) ?? name;
}

/** 홈 vs 어웨이 매치 라벨 (한글 우선) */
export function getDisplayMatchLabel(
  homeTeam: string,
  awayTeam: string,
): string {
  return `${getDisplayTeamName(homeTeam)} vs ${getDisplayTeamName(awayTeam)}`;
}
