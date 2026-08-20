/**
 * Read-only probe of local MLB Stats API research cache keys.
 * Does not call a Provider. Does not mutate prediction/engine.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function load(p: string): unknown {
  const raw = JSON.parse(readFileSync(p, "utf8")) as { body?: unknown };
  return raw.body ?? raw;
}

function main() {
  const root = path.join(
    process.cwd(),
    "data/cache/research/mlb/raw/statsapi/api/v1",
  );
  const personPath = path.join(root, "people", "701542.json");
  const logPath = path.join(
    root,
    "people",
    "701542",
    "stats_stats_gameLog_group_pitching_season_2026_sportId_1.json",
  );
  const boxPath = path.join(root, "game", "822696", "boxscore.json");

  const person = asRecord(load(personPath));
  const people0 = asRecord(
    Array.isArray(person?.people) ? person!.people[0] : person,
  );
  const personKeys = people0 ? Object.keys(people0).sort() : [];
  const batSide = asRecord(people0?.batSide);
  const pitchHand = asRecord(people0?.pitchHand);

  const logDoc = asRecord(load(logPath));
  const stats = Array.isArray(logDoc?.stats) ? logDoc!.stats : [];
  const firstStat = asRecord(stats[0]);
  const splits = Array.isArray(firstStat?.splits) ? firstStat!.splits : [];
  const split0 = asRecord(splits[0]);
  const splitStat = asRecord(split0?.stat);
  const pitchingStatKeys = splitStat ? Object.keys(splitStat).sort() : [];

  const box = asRecord(load(boxPath));
  const teams = asRecord(box?.teams);
  const home = asRecord(teams?.home);
  const players = asRecord(home?.players) ?? {};
  const firstPlayer = asRecord(Object.values(players)[0]);
  const playerKeys = firstPlayer ? Object.keys(firstPlayer).sort() : [];
  const seasonStats = asRecord(firstPlayer?.seasonStats);
  const hitting = asRecord(seasonStats?.hitting);
  const pitching = asRecord(seasonStats?.pitching);
  const hittingKeys = hitting ? Object.keys(hitting).sort() : [];
  const pitchingKeys = pitching ? Object.keys(pitching).sort() : [];
  const personInBox = asRecord(firstPlayer?.person);

  const venueDir = path.join(root, "venues");
  let venueKeys: string[] = [];
  let fieldInfoKeys: string[] = [];
  let locationKeys: string[] = [];
  if (existsSync(venueDir)) {
    const files = readdirSync(venueDir).filter((n) => n.endsWith(".json"));
    if (files[0]) {
      const vdoc = asRecord(load(path.join(venueDir, files[0])));
      const venues = Array.isArray(vdoc?.venues) ? vdoc!.venues : [];
      const v0 = asRecord(venues[0]) ?? vdoc;
      venueKeys = v0 ? Object.keys(v0).sort() : [];
      fieldInfoKeys = Object.keys(asRecord(v0?.fieldInfo) ?? {}).sort();
      locationKeys = Object.keys(asRecord(v0?.location) ?? {}).sort();
    }
  }

  const hittingGameLogExists = existsSync(
    path.join(
      root,
      "people",
      "701542",
      "stats_stats_gameLog_group_hitting_season_2026_sportId_1.json",
    ),
  );

  process.stdout.write(
    JSON.stringify(
      {
        personKeys,
        batSide,
        pitchHand,
        pitchingGameLogStatKeys: pitchingStatKeys,
        boxPlayerKeys: playerKeys,
        boxPersonKeys: personInBox ? Object.keys(personInBox).sort() : [],
        boxSeasonHittingKeys: hittingKeys,
        boxSeasonPitchingKeys: pitchingKeys,
        venueKeys,
        fieldInfoKeys,
        locationKeys,
        hittingGameLogCachedForSamplePitcher: hittingGameLogExists,
      },
      null,
      2,
    ) + "\n",
  );
}

main();
