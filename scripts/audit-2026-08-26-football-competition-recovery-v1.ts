/**
 * 2026-08-26 B1.1 football competition-registry recovery.
 *
 * Uses the already-captured API-Football dump only.
 * Does not call the Provider. Does not fuzzy-match teams.
 *
 *   npx tsx scripts/audit-2026-08-26-football-competition-recovery-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { instantToKst } from "../src/lib/datetime/kst";
import { FOOTBALL_COMPETITION_REGISTRY_V0 } from "../src/lib/football/foundation/competition-registry";
import { getCompetitionProfileByProviderId } from "../src/lib/football/competition";
import { DATE_KST, SOURCE_OBS_REL } from "./lock-2026-08-26-daily-scope-v1";
import {
  FIXTURES_CAPTURE_REL,
  loadFootballFixtureCapture,
  rebuildFootballScheduleFromCapture,
} from "./capture-2026-08-26-football-fixtures-v1";

export const FOOTBALL_COMPETITION_RECOVERY_REL =
  "data/audits/2026-08-26-football-competition-recovery-v1.json";

const TARGET_LABELS = new Set([
  "리그스컵",
  "호주FA컵",
  "일본FA컵",
  "축ASEA챔",
]);

/**
 * Prior exact operator-label → provider league mapping already sealed in repo.
 * Do not invent mappings for labels that only appear as screenshot text.
 */
const PRIOR_OPERATOR_LABEL_TO_PROVIDER_LEAGUE: Record<
  string,
  {
    providerLeagueId: string;
    officialName: string;
    evidence: string[];
  }
> = {
  축ASEA챔: {
    providerLeagueId: "24",
    officialName: "ASEAN Championship",
    evidence: [
      "data/research/football/2026-08-16-observed-slate-v0.json",
      "data/research/football/2026-08-16-manual-observation-fixture-mapping-v1.json",
    ],
  },
};

type CaptureFixture = {
  fixture: { id: number; date: string };
  league: { id: number; name: string };
  teams: { home: { name: string }; away: { name: string } };
};

type RecoveryDecision = "APPROVE_COMPETITION_REGISTRY" | "IDENTITY_REVIEW_REQUIRED";

function kickoffMatches(fixture: CaptureFixture, startKst: string): boolean {
  const k = instantToKst(fixture.fixture?.date);
  return Boolean(k && k.date === DATE_KST && k.time === startKst);
}

export async function runFootballCompetitionRecovery(cwd = process.cwd()) {
  const capture = loadFootballFixtureCapture(cwd);
  if (!capture) {
    throw new Error(`FOOTBALL_FIXTURE_CAPTURE_MISSING: ${FIXTURES_CAPTURE_REL}`);
  }

  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  if (!existsSync(obsAbs)) throw new Error("SOURCE_OBSERVATION_MISSING");
  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    nonMlbOddsFixtures: Array<{
      rawLeagueLabel: string;
      displayedDateKst: string;
      displayedStartKst: string;
      rawHome: string;
      rawAway: string;
    }>;
  };

  const operatorRows = obs.nonMlbOddsFixtures.filter(
    (row) =>
      row.displayedDateKst === DATE_KST && TARGET_LABELS.has(row.rawLeagueLabel),
  );
  if (operatorRows.length !== 11) {
    throw new Error(`TARGET_CUP_COUNT_MISMATCH: ${operatorRows.length}`);
  }

  const reviewRows = operatorRows.map((row) => {
    const kickoffHits = capture.fixtures.filter((fx) =>
      kickoffMatches(fx, row.displayedStartKst),
    );
    const prior = PRIOR_OPERATOR_LABEL_TO_PROVIDER_LEAGUE[row.rawLeagueLabel];
    const mappedHits = prior
      ? kickoffHits.filter(
          (fx) => String(fx.league.id) === prior.providerLeagueId,
        )
      : [];
    const decisionHits = prior ? mappedHits : kickoffHits;
    const candidateCount = decisionHits.length;
    const unique = candidateCount === 1 ? decisionHits[0]! : null;
    const kickoffObservedLeagues = [
      ...new Map(
        kickoffHits.map((fx) => [
          String(fx.league.id),
          {
            providerLeagueId: String(fx.league.id),
            providerLeagueName: fx.league.name,
            fixtureCount: 0,
          },
        ]),
      ).values(),
    ].map((league) => ({
      ...league,
      fixtureCount: kickoffHits.filter(
        (fx) => String(fx.league.id) === league.providerLeagueId,
      ).length,
    }));
    const alreadyRegistered = FOOTBALL_COMPETITION_REGISTRY_V0.some(
      (c) =>
        c.displayName === row.rawLeagueLabel ||
        (prior != null && c.providerCompetitionId === prior.providerLeagueId),
    );
    const profile = prior
      ? getCompetitionProfileByProviderId("api-football", prior.providerLeagueId)
      : null;

    let decision: RecoveryDecision = "IDENTITY_REVIEW_REQUIRED";
    const reasons: string[] = [];
    if (!prior) {
      reasons.push("NO_PRIOR_OPERATOR_LABEL_TO_PROVIDER_LEAGUE_MAPPING");
      reasons.push(`KICKOFF_CANDIDATE_COUNT:${kickoffHits.length}`);
      reasons.push("NO_FUZZY_TEAM_NAME_INFERENCE");
    } else if (candidateCount !== 1) {
      reasons.push("PRIOR_MAPPING_PRESENT_BUT_NOT_UNIQUE");
      reasons.push(`CANDIDATE_COUNT:${candidateCount}`);
    } else if (!alreadyRegistered || !profile) {
      reasons.push("DETERMINISTIC_BUT_REGISTRY_NOT_YET_EXTENDED");
    } else {
      decision = "APPROVE_COMPETITION_REGISTRY";
      reasons.push("PRIOR_EXACT_OPERATOR_LABEL_MAPPING");
      reasons.push("UNIQUE_KICKOFF_AND_PROVIDER_LEAGUE_ID");
      reasons.push(`PROVIDER_LEAGUE_ID:${prior.providerLeagueId}`);
      reasons.push(`PROVIDER_LEAGUE_NAME:${unique!.league.name}`);
      reasons.push(`PROVIDER_FIXTURE_ID:${unique!.fixture.id}`);
    }

    if (row.rawHome === "V센다이" && row.rawAway === "도치기SC") {
      reasons.push(
        "TOCHIGI_CITY_AND_TOCHIGI_SC_BOTH_PRESENT_AT_SAME_KICKOFF_NO_FUZZY",
      );
    }

    return {
      operatorGame: `${row.rawHome} : ${row.rawAway}`,
      operatorCompetitionLabel: row.rawLeagueLabel,
      providerFixtureId: unique ? String(unique.fixture.id) : null,
      providerLeagueId: unique ? String(unique.league.id) : null,
      providerLeagueName: unique ? unique.league.name : null,
      providerHome: unique ? unique.teams.home.name : null,
      providerAway: unique ? unique.teams.away.name : null,
      kickoff: unique
        ? unique.fixture.date
        : `${DATE_KST}T${row.displayedStartKst}:00+09:00`,
      candidateCount,
      kickoffCandidateCount: kickoffHits.length,
      decision,
      reasons,
      priorMapping: prior ?? null,
      kickoffObservedLeagues,
    };
  });

  const approved = reviewRows.filter(
    (r) => r.decision === "APPROVE_COMPETITION_REGISTRY",
  );
  const blocked = reviewRows.filter(
    (r) => r.decision === "IDENTITY_REVIEW_REQUIRED",
  );

  const document = {
    schemaVersion: "yang-edge-football-competition-recovery-v1",
    dateKst: DATE_KST,
    researchOnly: true,
    predictionInput: false,
    engineConnected: false,
    sourceCaptureRel: FIXTURES_CAPTURE_REL,
    capturedAt: capture.capturedAt,
    fixtureCount: capture.fixtureCount,
    networkCallMadeForThisAudit: false,
    operatorCupRows: 11,
    approvedRegistryCount: approved.length,
    stillBlockedCount: blocked.length,
    approvedCompetitions: approved.map((r) => ({
      operatorCompetitionLabel: r.operatorCompetitionLabel,
      providerLeagueId: r.providerLeagueId,
      providerLeagueName: r.providerLeagueName,
      providerFixtureId: r.providerFixtureId,
    })),
    note: "Unregistered cup rows keep IDENTITY_REVIEW_REQUIRED because kickoff is not unique and no prior exact operator-label mapping exists. League IDs observed at those kickoffs are dump evidence only and are not registered.",
    rows: reviewRows,
  };

  const outAbs = path.join(cwd, FOOTBALL_COMPETITION_RECOVERY_REL);
  await mkdir(path.dirname(outAbs), { recursive: true });
  await writeFile(outAbs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  const rebuilt = await rebuildFootballScheduleFromCapture(cwd);

  return {
    document,
    outRel: FOOTBALL_COMPETITION_RECOVERY_REL,
    scheduleRel: rebuilt.outRel,
    scheduleGames: rebuilt.document.meta.scheduleGames,
    droppedUnregisteredCompetition:
      rebuilt.document.meta.droppedUnregisteredCompetition,
  };
}

async function main() {
  const result = await runFootballCompetitionRecovery();
  console.log(
    JSON.stringify(
      {
        wrote: result.outRel,
        approvedRegistryCount: result.document.approvedRegistryCount,
        stillBlockedCount: result.document.stillBlockedCount,
        scheduleRel: result.scheduleRel,
        scheduleGames: result.scheduleGames,
        droppedUnregisteredCompetition: result.droppedUnregisteredCompetition,
        networkCallMadeForThisAudit: false,
      },
      null,
      2,
    ),
  );
}

const isDirectRun =
  !!process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
