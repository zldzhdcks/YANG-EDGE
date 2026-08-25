/**
 * Operational slate teams from existing Schedule v1 artifacts.
 * Evidence: API-Football team id + name already stored on each schedule row
 * (copied from fixture.teams at collect time). Not name-only mapping.
 *
 * country is UNKNOWN: schedule rows do not carry team country.
 */
export const FOOTBALL_IDENTITY_SCOPE_V1 = "PROVIDER_SEEDED_V1" as const;

export const SLATE_SRC_2026_08_12 =
  "data/research/football/2026-08-12-schedule-v1.json" as const;
export const SLATE_SRC_2026_08_14 =
  "data/research/football/2026-08-14-schedule-v1.json" as const;
export const SLATE_SRC_2026_08_17 =
  "data/research/football/2026-08-17-schedule-v1.json" as const;
export const SLATE_SRC_2026_08_18 =
  "data/research/football/2026-08-18-schedule-v1.json" as const;
export const SLATE_SRC_2026_08_25 =
  "data/research/football/2026-08-25-schedule-v1.json" as const;

/** [providerTeamId, providerReportedName] */
export type SlateTeamSeed = readonly [string, string];

/** Unique api-football team ids from 2026-08-12 UCL/UEL rows. */
export const FOOTBALL_SLATE_2026_08_12_TEAMS: SlateTeamSeed[] = [
  ["327", "Bodo/Glimt"],
  ["1393", "Union St. Gilloise"],
  ["80", "Lyon"],
  ["628", "Sparta Praha"],
  ["413", "NEC Nijmegen"],
  ["553", "Olympiakos Piraeus"],
  ["4360", "Celje"],
  ["3683", "Ararat-Armenia"],
  ["598", "FK Crvena Zvezda"],
  ["563", "Hapoel Beer Sheva"],
  ["664", "Kairat Almaty"],
  ["646", "Levski Sofia"],
  ["3872", "Kauno Žalgiris"],
  ["620", "Dinamo Zagreb"],
  ["13976", "Sabah FA"],
  ["406", "Aarhus"],
  ["656", "Slovan Bratislava"],
  ["2240", "Mjallby AIF"],
  ["637", "Sturm Graz"],
  ["611", "Fenerbahçe"],
  ["3502", "Saburtalo"],
  ["5354", "Larne"],
];

/** Unique api-football team ids from 2026-08-14 J1/UEL rows. */
export const FOOTBALL_SLATE_2026_08_14_TEAMS: SlateTeamSeed[] = [
  ["306", "Tokyo Verdy"],
  ["281", "Kashiwa Reysol"],
  ["257", "Rangers"],
  ["336", "Jagiellonia"],
  ["3327", "Egnatia Rrogozhinë"],
  ["652", "Shamrock Rovers"],
  ["701", "KI Klaksvik"],
  ["347", "Lech Poznan"],
  ["3402", "Omonia Nicosia"],
  ["667", "Lincoln Red Imps FC"],
  ["632", "Universitatea Craiova"],
  ["1165", "KuPS"],
  ["278", "Vikingur Reykjavik"],
  ["1012", "FC Thun"],
  ["554", "Anderlecht"],
  ["619", "PAOK"],
  ["549", "Beşiktaş"],
  ["3723", "Hradec Králové"],
  ["853", "CSKA Sofia"],
  ["604", "Maccabi Tel Aviv"],
  ["340", "Gornik Zabrze"],
  ["651", "Ferencvarosi TC"],
  ["254", "Heart Of Midlothian"],
  ["211", "Benfica"],
  ["3403", "Pafos"],
  ["571", "Red Bull Salzburg"],
];

/**
 * La Liga IDENTITY_REVIEW_REQUIRED rows on 2026-08-17 schedule.
 * Seed only the four provider [id, name] pairs stored on that artifact.
 * Historical schedule is not rejoined.
 */
export const FOOTBALL_SLATE_2026_08_17_TEAMS: SlateTeamSeed[] = [
  ["540", "Espanyol"],
  ["539", "Levante"],
  ["4665", "Racing Santander"],
  ["533", "Villarreal"],
];

/**
 * La Liga IDENTITY_REVIEW_REQUIRED row on 2026-08-18 schedule.
 * Seed only the two provider [id, name] pairs stored on that artifact.
 * Historical schedules are not rejoined.
 */
export const FOOTBALL_SLATE_2026_08_18_TEAMS: SlateTeamSeed[] = [
  ["544", "Deportivo La Coruna"],
  ["797", "Elche"],
];

/**
 * Registered-competition IDENTITY_REVIEW_REQUIRED rows on 2026-08-25 schedule.
 * Seed only missing exact [providerTeamId, providerReportedName] pairs stored
 * on that artifact. Already-cataloged IDs and conflict-blocked IDs are omitted.
 * 2768 Gimcheon Sangmu FC is withheld: repo already maps Gimcheon to 7002.
 */
export const FOOTBALL_SLATE_2026_08_25_TEAMS: SlateTeamSeed[] = [
  ["2745", "Bucheon FC 1995"],
  ["497", "AS Roma"],
  ["502", "Fiorentina"],
  ["500", "Bologna"],
  ["487", "Lazio"],
  ["36", "Fulham"],
  ["49", "Chelsea"],
  ["535", "Malaga"],
  ["727", "Osasuna"],
];
