/**
 * NPB.jp day-score collection for 2026-08-07.
 * Scores from https://npb.jp/games/2026/08/07/ (試合終了 cards).
 * Orientation = official venue home/away (title order on NPB.jp).
 */
import type { NpbCollectedOfficialGameV0 } from "./types";

const DATE = "2026-08-07";
const DAY_PATH = "0807";

function boxUrl(key: string): string {
  return `https://npb.jp/scores/2026/${DAY_PATH}/${key}/`;
}

/** Venue-oriented finals for 2026-08-07 (all FINAL). */
export const NPB_COLLECTED_OFFICIAL_2026_08_07: NpbCollectedOfficialGameV0[] = [
  {
    sourceGameKey: "g-s-17",
    awayTeam: "Tokyo Yakult Swallows",
    homeTeam: "Yomiuri Giants",
    awayScore: 1,
    homeScore: 0,
    status: "FINAL",
    sourceUrl: boxUrl("g-s-17"),
  },
  {
    sourceGameKey: "db-c-16",
    awayTeam: "Hiroshima Toyo Carp",
    homeTeam: "Yokohama DeNA BayStars",
    awayScore: 1,
    homeScore: 2,
    status: "FINAL",
    sourceUrl: boxUrl("db-c-16"),
  },
  {
    sourceGameKey: "t-d-17",
    awayTeam: "Chunichi Dragons",
    homeTeam: "Hanshin Tigers",
    awayScore: 3,
    homeScore: 2,
    status: "FINAL",
    sourceUrl: boxUrl("t-d-17"),
  },
  {
    sourceGameKey: "f-e-17",
    awayTeam: "Tohoku Rakuten Golden Eagles",
    homeTeam: "Hokkaido Nippon-Ham Fighters",
    awayScore: 2,
    homeScore: 3,
    status: "FINAL",
    sourceUrl: boxUrl("f-e-17"),
  },
  {
    sourceGameKey: "l-h-18",
    awayTeam: "Fukuoka SoftBank Hawks",
    homeTeam: "Saitama Seibu Lions",
    awayScore: 5,
    homeScore: 2,
    status: "FINAL",
    sourceUrl: boxUrl("l-h-18"),
  },
  {
    sourceGameKey: "m-b-18",
    awayTeam: "Orix Buffaloes",
    homeTeam: "Chiba Lotte Marines",
    awayScore: 6,
    homeScore: 2,
    status: "FINAL",
    sourceUrl: boxUrl("m-b-18"),
  },
];

export function collectedOfficialForDate(
  dateKst: string,
): NpbCollectedOfficialGameV0[] | null {
  if (dateKst === DATE) return NPB_COLLECTED_OFFICIAL_2026_08_07;
  return null;
}
