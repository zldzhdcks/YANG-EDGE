/**
 * Operational slate teams from existing Schedule v1 artifacts.
 * Evidence: API-Football team id + name already stored on each schedule row
 * (copied from fixture.teams at collect time). Not name-only mapping.
 *
 * country is UNKNOWN: schedule rows do not carry team country.
 */
export const SLATE_SRC_2026_09_05 =
  "data/research/football/2026-09-05-schedule-v1.json" as const;

/** [providerTeamId, providerReportedName] */
export type SlateTeamSeed = readonly [string, string];

/**
 * Upcoming IDENTITY_REVIEW_REQUIRED registered-competition rows on
 * 2026-09-05 schedule. Seed only missing exact [providerTeamId,
 * providerReportedName] pairs stored on that artifact.
 *
 * Already-cataloged IDs omitted: 36 Fulham, 50 Manchester City,
 * 502 Fiorentina, 2745 Bucheon FC 1995, 2766 FC Seoul.
 *
 * Withheld:
 * - 2761 / 2762 / 2763 existing catalog ID + incompatible observed name
 * - 2764 blocked K League conflict ID (Ulsan HD 275 vs 2764)
 * - 2750 Daejeon Citizen: aliases/catalog already map Daejeon to 2759
 * - 2767 Ulsan Hyundai FC: Ulsan remains an unresolved K League conflict
 */
export const FOOTBALL_SLATE_2026_09_05_TEAMS: SlateTeamSeed[] = [
  ["34", "Newcastle"],
  ["35", "Bournemouth"],
  ["47", "Tottenham"],
  ["51", "Brighton"],
  ["52", "Crystal Palace"],
  ["55", "Brentford"],
  ["63", "Leeds"],
  ["65", "Nottingham Forest"],
  ["160", "SC Freiburg"],
  ["162", "Werder Bremen"],
  ["163", "Borussia Mönchengladbach"],
  ["165", "Borussia Dortmund"],
  ["167", "1899 Hoffenheim"],
  ["168", "Bayer Leverkusen"],
  ["173", "RB Leipzig"],
  ["182", "Union Berlin"],
  ["185", "SC Paderborn 07"],
  ["305", "Mito Hollyhock"],
  ["316", "Avispa Fukuoka"],
  ["503", "Torino"],
  ["530", "Atletico Madrid"],
  ["531", "Athletic Club"],
  ["746", "Sunderland"],
  ["1346", "Coventry"],
  ["1660", "SV Elversberg"],
];
