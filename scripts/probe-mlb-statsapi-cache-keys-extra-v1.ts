/**
 * Extra read-only cache probes: batter seasonStats in boxscore + schedule dayNight/weather.
 */
import { readFileSync } from "node:fs";
import path from "path";

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
  const boxPath = path.join(
    process.cwd(),
    "data/cache/research/mlb/raw/statsapi/api/v1/game/822696/boxscore.json",
  );
  const box = asRecord(load(boxPath));
  const teams = asRecord(box?.teams);
  const hittingKeys = new Set<string>();
  const battingGameKeys = new Set<string>();
  let batterSamples = 0;
  for (const side of ["home", "away"]) {
    const team = asRecord(teams?.[side]);
    const players = asRecord(team?.players) ?? {};
    for (const pl of Object.values(players)) {
      const rec = asRecord(pl);
      const hitting = asRecord(asRecord(rec?.seasonStats)?.hitting);
      const batting = asRecord(asRecord(rec?.stats)?.batting);
      if (hitting && Object.keys(hitting).length > 0) {
        batterSamples += 1;
        for (const k of Object.keys(hitting)) hittingKeys.add(k);
      }
      if (batting && Object.keys(batting).length > 0) {
        for (const k of Object.keys(batting)) battingGameKeys.add(k);
      }
    }
  }

  const schedPath = path.join(
    process.cwd(),
    "data/cache/research/mlb/raw/statsapi/api/v1/schedule_sportId_1_date_2026-08-19_hydrate_probablePitcher_2Clineups.json",
  );
  const sched = asRecord(load(schedPath));
  const dates = Array.isArray(sched?.dates) ? sched!.dates : [];
  const games = asRecord(dates[0])?.games;
  const g0 = asRecord(Array.isArray(games) ? games[0] : null);
  const gameKeys = g0 ? Object.keys(g0).sort() : [];
  const weather = asRecord(g0?.weather);
  const venue = asRecord(g0?.venue);
  const status = asRecord(g0?.status);

  process.stdout.write(
    JSON.stringify(
      {
        batterSeasonHittingSamples: batterSamples,
        seasonHittingKeys: [...hittingKeys].sort(),
        boxGameBattingStatKeys: [...battingGameKeys].sort(),
        scheduleGameKeys: gameKeys,
        weather,
        venueKeys: venue ? Object.keys(venue).sort() : [],
        dayNight: g0?.dayNight ?? null,
        gameDate: g0?.gameDate ?? null,
        status,
      },
      null,
      2,
    ) + "\n",
  );
}

main();
