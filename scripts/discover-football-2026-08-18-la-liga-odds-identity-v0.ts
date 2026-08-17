/**
 * Identity-only The Odds API discovery for 2026-08-18 La Liga fixture 1570337.
 *
 * Calls GET /odds with sportKey=soccer_spain_la_liga, markets=h2h, regions=eu.
 * Does not write football-1x2-odds-v1. Does not auto-join. No fuzzy team matching.
 *
 *   npx tsx --env-file=.env.local scripts/discover-football-2026-08-18-la-liga-odds-identity-v0.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getOddsProvider, resolveOddsProviderKind } from "../src/lib/odds";
import { FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES } from "../src/lib/football/odds-1x2-v1";
import { parseFootballScheduleArtifact } from "../src/lib/football/odds-1x2-v1";

const SPORT_KEY = "soccer_spain_la_liga";
const TARGET_FIXTURE_ID = "1570337";
const SCHEDULE_REL = "data/research/football/2026-08-18-schedule-v1.json";
const EVIDENCE_REL =
  "data/research/football/2026-08-18-la-liga-odds-identity-evidence-v0.json";

function toMs(iso: string | null | undefined): number {
  return iso ? Date.parse(iso) : Number.NaN;
}

async function main() {
  const kind = resolveOddsProviderKind();
  if (kind === "dummy") {
    throw new Error("DUMMY_ODDS_PROVIDER_NOT_RESEARCH");
  }
  const provider = getOddsProvider();
  if (provider.kind === "dummy") {
    throw new Error("DUMMY_ODDS_PROVIDER_NOT_RESEARCH");
  }

  const schedule = parseFootballScheduleArtifact(
    JSON.parse(await readFile(path.join(process.cwd(), SCHEDULE_REL), "utf8")),
  );
  const row = schedule.rows.find((r) => r.providerMatchId === TARGET_FIXTURE_ID);
  if (!row) throw new Error("TARGET_SCHEDULE_ROW_MISSING");

  const sportKeyMapped =
    row.competitionId === "fb-comp-api-football-140" ? SPORT_KEY : null;
  if (sportKeyMapped !== SPORT_KEY) {
    throw new Error("SPORT_KEY_NOT_EXPLICIT");
  }

  let sportKeyExactMatch: {
    key: string;
    title: string;
    group: string;
    active: boolean;
  } | null = null;
  let sportsUsage = null;
  if (provider.listSports) {
    const sportsResult = await provider.listSports();
    sportsUsage = sportsResult.usage;
    const hit = sportsResult.sports.find((s) => s.key === SPORT_KEY) ?? null;
    sportKeyExactMatch = hit
      ? {
          key: hit.key,
          title: hit.title,
          group: hit.group,
          active: hit.active,
        }
      : null;
  }
  if (!sportKeyExactMatch) {
    throw new Error("SPORT_KEY_NOT_ON_PROVIDER_SPORTS_LIST");
  }

  const observedAt = new Date().toISOString();
  const oddsResult = await provider.getOdds({
    sportKey: SPORT_KEY,
    markets: "h2h",
    regions: "eu",
  });

  const kickoffMs = toMs(row.kickoffTimeUtc);
  const events = oddsResult.events.map((e) => {
    const commenceMs = toMs(e.commenceTime);
    const deltaMinutes =
      Number.isFinite(kickoffMs) && Number.isFinite(commenceMs)
        ? (commenceMs - kickoffMs) / 60000
        : null;
    return {
      oddsProviderEventId: e.externalEventId,
      sportKey: e.sportKey,
      rawHomeTeam: e.homeTeam,
      rawAwayTeam: e.awayTeam,
      commenceTime: e.commenceTime,
      kickoffDeltaMinutes: deltaMinutes,
      exactCommenceTime:
        e.commenceTime === row.kickoffTimeUtc ||
        e.commenceTime === row.kickoffTimeUtc.replace(".000Z", "Z"),
      withinJoinTolerance:
        deltaMinutes != null &&
        Math.abs(deltaMinutes) <= FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
      bookmakerCount: e.bookmakers.length,
    };
  });

  const exactTimeCandidates = events.filter((e) => e.exactCommenceTime);
  const compatibleTimeCandidates = events.filter((e) => e.withinJoinTolerance);

  let identificationStatus: "UNIQUE_CANDIDATE" | "AMBIGUOUS_ODDS_EVENT" | "NO_TIME_CANDIDATE";
  let candidateEventId: string | null = null;
  if (exactTimeCandidates.length === 1) {
    identificationStatus = "UNIQUE_CANDIDATE";
    candidateEventId = exactTimeCandidates[0]!.oddsProviderEventId;
  } else if (exactTimeCandidates.length > 1) {
    identificationStatus = "AMBIGUOUS_ODDS_EVENT";
  } else if (compatibleTimeCandidates.length === 1) {
    identificationStatus = "UNIQUE_CANDIDATE";
    candidateEventId = compatibleTimeCandidates[0]!.oddsProviderEventId;
  } else if (compatibleTimeCandidates.length > 1) {
    identificationStatus = "AMBIGUOUS_ODDS_EVENT";
  } else {
    identificationStatus = "NO_TIME_CANDIDATE";
  }

  const candidate =
    events.find((e) => e.oddsProviderEventId === candidateEventId) ?? null;

  const evidence = {
    schemaVersion: "football-la-liga-odds-identity-evidence-v0",
    observedAt,
    researchOnly: true,
    predictionInput: false,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    officialOddsDataset: false,
    source: "the-odds-api",
    sportKey: SPORT_KEY,
    markets: "h2h",
    regions: "eu",
    scheduleRel: SCHEDULE_REL,
    scheduleFixtureId: row.providerMatchId,
    scheduleCompetitionId: row.competitionId,
    scheduleKickoffTimeUtc: row.kickoffTimeUtc,
    scheduleHomeProviderTeamId: row.homeProviderTeamId,
    scheduleAwayProviderTeamId: row.awayProviderTeamId,
    scheduleHomeTeamName: row.homeTeamName,
    scheduleAwayTeamName: row.awayTeamName,
    scheduleHomeCanonicalTeamId: row.homeTeamId,
    scheduleAwayCanonicalTeamId: row.awayTeamId,
    sportKeyExactMatch,
    sportsUsage,
    oddsUsage: oddsResult.usage,
    providerCached: oddsResult.cached,
    eventCount: events.length,
    identificationStatus,
    candidateEventId,
    candidate,
    exactTimeCandidateCount: exactTimeCandidates.length,
    compatibleTimeCandidateCount: compatibleTimeCandidates.length,
    kickoffToleranceMinutes: FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
    events,
    note: "Identity evidence only. Team names are raw Odds provider strings. No fuzzy matching. Not a football-1x2-odds-v1 artifact.",
  };

  const outPath = path.join(process.cwd(), EVIDENCE_REL);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        wrote: EVIDENCE_REL,
        observedAt,
        identificationStatus,
        candidateEventId,
        candidateHome: candidate?.rawHomeTeam ?? null,
        candidateAway: candidate?.rawAwayTeam ?? null,
        candidateCommenceTime: candidate?.commenceTime ?? null,
        eventCount: events.length,
        exactTimeCandidateCount: exactTimeCandidates.length,
        compatibleTimeCandidateCount: compatibleTimeCandidates.length,
        requestsUsed: oddsResult.usage.requestsUsed,
        requestsRemaining: oddsResult.usage.requestsRemaining,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
