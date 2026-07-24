/**
 * YANG EDGE 내부 gameId 생성 규칙
 *
 * 형식: `{league}-{home}-{away}`
 * - 전부 소문자
 * - 공백/언더스코어 → 하이픈
 * - 영문·숫자·한글만 유지, 그 외 특수문자 제거
 * - 연속 하이픈 축약, 양끝 하이픈 제거
 *
 * 팀명 별칭(한글→영문 슬러그)은 기존 더미 ID 호환용.
 */

const LEAGUE_SLUG_ALIASES: Record<string, string> = {
  npb: "npb",
  kbo: "kbo",
  "nippon baseball league": "npb",
  "korean kbo league": "kbo",
  "k리그": "kleague",
  epl: "epl",
  nba: "nba",
  kbl: "kbl",
};

const TEAM_SLUG_ALIASES: Record<string, string> = {
  소프트뱅크: "softbank",
  오릭스: "orix",
  한신: "hanshin",
  요미우리: "yomiuri",
  히로시마: "hiroshima",
  lg: "lg",
  두산: "doosan",
  kia: "kia",
  ssg: "ssg",
  울산: "ulsan",
  전북: "jeonbuk",
  아스널: "arsenal",
  리버풀: "liverpool",
};

function collapseHyphens(value: string): string {
  return value.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/**
 * 팀/리그 문자열을 URL-safe 슬러그로 변환.
 */
export function slugifyToken(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "unknown";

  const alias = TEAM_SLUG_ALIASES[trimmed.toLowerCase()] ?? TEAM_SLUG_ALIASES[trimmed];
  if (alias) return alias;

  const lower = trimmed.toLowerCase();
  const leagueAlias = LEAGUE_SLUG_ALIASES[lower];
  if (leagueAlias) return leagueAlias;

  const slug = lower
    .normalize("NFKC")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\uac00-\ud7a3-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "unknown";
}

export function slugifyLeague(league: string): string {
  const trimmed = (league ?? "").trim();
  const lower = trimmed.toLowerCase();
  if (LEAGUE_SLUG_ALIASES[lower]) return LEAGUE_SLUG_ALIASES[lower];
  return slugifyToken(trimmed);
}

export function slugifyTeam(teamName: string): string {
  return slugifyToken(teamName);
}

/**
 * 내부 gameId 생성: league-home-away
 */
export function buildGameId(
  league: string,
  homeTeam: string,
  awayTeam: string,
): string {
  return collapseHyphens(
    [slugifyLeague(league), slugifyTeam(homeTeam), slugifyTeam(awayTeam)].join(
      "-",
    ),
  );
}
