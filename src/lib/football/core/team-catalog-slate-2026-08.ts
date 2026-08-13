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
