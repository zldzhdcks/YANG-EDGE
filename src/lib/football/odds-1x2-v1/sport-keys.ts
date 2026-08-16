/**
 * Explicit Competition Profile → The Odds API sport key.
 * J1 League 검증된 sport key는 2026-08-13 The Odds API /sports
 * 응답의 exact key soccer_japan_j_league 와 일치한 뒤에만 추가됐다.
 * UCL / UEL 는 아직 미매핑.
 * MLS sport key는 2026-08-16 comparison overlay의 live /sports exact key
 * soccer_usa_mls 검증 뒤에만 추가됐다.
 */
import {
  FOOTBALL_ODDS_SPORT_KEY_MAP_VERSION,
  type FootballOddsSportKeyEntry,
} from "./types";

export { FOOTBALL_ODDS_SPORT_KEY_MAP_VERSION };

const AUDIT =
  "data/audits/multi-sport-historical-odds-coverage-audit-v1.json";
const SPORTS_LIVE_2026_08_13 =
  "the-odds-api:/sports exact key soccer_japan_j_league verifiedAt=2026-08-13T14:59:35.477Z";
const MLS_SPORTS_LIVE_2026_08_16 =
  "data/research/football/2026-08-16-1x2-market-comparison-v0.json the-odds-api:/sports exact key soccer_usa_mls verifiedAt=2026-08-16T14:27:47.964Z";

export const FOOTBALL_ODDS_SPORT_KEY_MAP_V1: FootballOddsSportKeyEntry[] = [
  {
    competitionId: "fb-comp-api-football-39",
    sportKey: "soccer_epl",
    source: AUDIT,
  },
  {
    competitionId: "fb-comp-api-football-140",
    sportKey: "soccer_spain_la_liga",
    source: AUDIT,
  },
  {
    competitionId: "fb-comp-api-football-78",
    sportKey: "soccer_germany_bundesliga",
    source: AUDIT,
  },
  {
    competitionId: "fb-comp-api-football-135",
    sportKey: "soccer_italy_serie_a",
    source: AUDIT,
  },
  {
    competitionId: "fb-comp-api-football-61",
    sportKey: "soccer_france_ligue_one",
    source: AUDIT,
  },
  {
    competitionId: "fb-comp-api-football-292",
    sportKey: "soccer_korea_kleague1",
    source: AUDIT,
  },
  {
    competitionId: "fb-comp-api-football-98",
    sportKey: "soccer_japan_j_league",
    source: SPORTS_LIVE_2026_08_13,
  },
  {
    competitionId: "fb-comp-api-football-253",
    sportKey: "soccer_usa_mls",
    source: MLS_SPORTS_LIVE_2026_08_16,
  },
];

const BY_COMPETITION = new Map(
  FOOTBALL_ODDS_SPORT_KEY_MAP_V1.map((e) => [e.competitionId, e]),
);

export function getOddsSportKey(
  competitionId: string,
): FootballOddsSportKeyEntry | null {
  return BY_COMPETITION.get(competitionId) ?? null;
}
