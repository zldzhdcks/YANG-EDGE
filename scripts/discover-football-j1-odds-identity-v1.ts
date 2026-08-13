/**
 * Quota-free J1 identity discovery.
 * GET /sports then GET /sports/soccer_japan_j_league/events.
 * Does not call /odds. Does not write artifacts. Does not auto-join.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getOddsProvider, resolveOddsProviderKind } from "../src/lib/odds";
import { parseFootballScheduleArtifact } from "../src/lib/football/odds-1x2-v1";
import { footballScheduleV1Rel } from "../src/lib/football/core";

const CANDIDATE_SPORT_KEY = "soccer_japan_j_league";
const TARGET_MATCH_ID = "soccer-api-football-1556021";

async function main() {
  const kind = resolveOddsProviderKind();
  if (kind === "dummy") {
    throw new Error("DUMMY_ODDS_PROVIDER_NOT_RESEARCH");
  }
  const provider = getOddsProvider();
  if (provider.kind === "dummy" || !provider.listSports || !provider.listEvents) {
    throw new Error("ODDS_DISCOVERY_ENDPOINTS_REQUIRED");
  }

  const schedulePath = path.join(process.cwd(), footballScheduleV1Rel("2026-08-14"));
  const schedule = parseFootballScheduleArtifact(
    JSON.parse(await readFile(schedulePath, "utf8")),
  );
  const row = schedule.rows.find((r) => r.matchId === TARGET_MATCH_ID);
  if (!row) throw new Error("TARGET_SCHEDULE_ROW_MISSING");
  if (row.predictionEligibility !== "ELIGIBLE_FORMAT") {
    throw new Error(
      `TARGET_NOT_ELIGIBLE_FORMAT: ${row.predictionEligibility}`,
    );
  }

  const sportsResult = await provider.listSports();
  const j1 = sportsResult.sports.find((s) => s.key === CANDIDATE_SPORT_KEY);
  const eventsResult = j1
    ? await provider.listEvents(CANDIDATE_SPORT_KEY)
    : { events: [], usage: sportsResult.usage };

  const now = new Date().toISOString();
  const summary = {
    discoveryOnly: true,
    oddsRequestMade: false,
    now,
    scheduleKickoffTimeUtc: row.kickoffTimeUtc,
    preKickoff:
      row.kickoffTimeUtc != null &&
      Date.parse(now) < Date.parse(row.kickoffTimeUtc),
    matchId: row.matchId,
    providerMatchId: row.providerMatchId,
    competitionId: row.competitionId,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    predictionEligibility: row.predictionEligibility,
    candidateSportKey: CANDIDATE_SPORT_KEY,
    sportKeyExactMatch: j1
      ? {
          key: j1.key,
          title: j1.title,
          group: j1.group,
          active: j1.active,
        }
      : null,
    sportsUsage: sportsResult.usage,
    eventsUsage: j1 ? eventsResult.usage : null,
    eventCount: eventsResult.events.length,
    events: eventsResult.events.map((e) => ({
      oddsProviderEventId: e.externalEventId,
      sportKey: e.sportKey,
      homeTeam: e.homeTeam,
      awayTeam: e.awayTeam,
      commenceTime: e.commenceTime,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
