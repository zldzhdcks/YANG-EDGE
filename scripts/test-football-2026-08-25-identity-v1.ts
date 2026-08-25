/**
 * Narrow 2026-08-25 football identity + Odds bridge graduation.
 * Evidence:
 *   data/research/football/2026-08-25-schedule-v1.json
 *   data/research/football/2026-08-25-odds-bridge-candidate-intake-v1.json
 *   data/research/football/2026-08-25-1x2-odds-v1.json
 * Run: npm run test:football-2026-08-25-identity-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS,
  FOOTBALL_SLATE_2026_08_12_TEAMS,
  FOOTBALL_SLATE_2026_08_14_TEAMS,
  FOOTBALL_SLATE_2026_08_17_TEAMS,
  FOOTBALL_SLATE_2026_08_18_TEAMS,
  FOOTBALL_SLATE_2026_08_25_TEAMS,
  FOOTBALL_TEAM_CATALOG_V1,
  rejoinFootballScheduleArtifact,
  resolveProviderTeam,
  type FootballScheduleArtifactV1,
} from "../src/lib/football/core";
import {
  FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  INTAKE_2026_08_25_OBSERVED_AT,
  MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  assertOddsTeamBridgeIntegrity,
  getOddsTeamNames,
  oddsNameMatchesCanonical,
} from "../src/lib/football/odds-1x2-v1";

const SCHEDULE_REL = "data/research/football/2026-08-25-schedule-v1.json";
const INTAKE_REL =
  "data/research/football/2026-08-25-odds-bridge-candidate-intake-v1.json";
const ODDS_REL = "data/research/football/2026-08-25-1x2-odds-v1.json";

const APPROVED_SEEDS: ReadonlyArray<readonly [string, string]> = [
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

const ALREADY_CATALOGED = ["2762", "2761", "2766", "544", "539"] as const;
const BLOCKED_ID = "2764";
const WITHHELD_GIMCHEON_ID = "2768";
const EXISTING_GIMCHEON_ID = "7002";
const BLOCKED_MATCH_IDS = [
  "soccer-api-football-1507040",
  "soccer-api-football-1507041",
] as const;
const ELIGIBLE_MATCH_IDS = [
  "soccer-api-football-1507042",
  "soccer-api-football-1550087",
  "soccer-api-football-1550089",
  "soccer-api-football-1557376",
  "soccer-api-football-1570349",
  "soccer-api-football-1570350",
] as const;

const FIRST_ODDS_ARTIFACT_HASH =
  "617e29e4fbe397f0db73fe586bd452fa314153b7e699d60aeeb50f05d554d68f";
const FIRST_ODDS_SCHEDULE_HASH =
  "06595340bc162ad31fba9e6dea2131bc76cbe76dddc1c9d88a938650d6e3f608";
const INTAKE_ARTIFACT_HASH =
  "869ad8949c8f584a3528ec680d9e0bb343537e2f7bd85af214f1d80564da77c8";

const ISOLATION_PATHS = [
  "src/lib/football/prediction-snapshot-v0",
  "src/lib/football/market-baseline-prediction-v0",
  "src/lib/engine",
  "src/lib/football/official-result-v0",
] as const;

type IntakeArtifact = {
  meta: { artifactHash: string };
  rows: Array<{
    schedule: { providerMatchId: string };
    candidateEvents: Array<{
      externalEventId: string;
      homeTeamExact: string;
      awayTeamExact: string;
    }>;
    candidateMappings: Array<{
      canonicalTeamId: string;
      oddsExactName: string;
    }>;
  }>;
};

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), rel)))
    .digest("hex");
}

function intakeRow(intake: IntakeArtifact, providerMatchId: string) {
  const row = intake.rows.find(
    (r) => r.schedule.providerMatchId === providerMatchId,
  );
  assert.ok(row, `intake missing ${providerMatchId}`);
  return row!;
}

function main() {
  assert.deepEqual(FOOTBALL_SLATE_2026_08_25_TEAMS, APPROVED_SEEDS);
  assert.equal(
    FOOTBALL_SLATE_2026_08_25_TEAMS.some(([id]) => id === WITHHELD_GIMCHEON_ID),
    false,
  );

  const priorSlateIds = [
    ...FOOTBALL_SLATE_2026_08_12_TEAMS,
    ...FOOTBALL_SLATE_2026_08_14_TEAMS,
    ...FOOTBALL_SLATE_2026_08_17_TEAMS,
    ...FOOTBALL_SLATE_2026_08_18_TEAMS,
  ].map(([id]) => id);
  for (const [id] of FOOTBALL_SLATE_2026_08_25_TEAMS) {
    assert.equal(priorSlateIds.includes(id), false, `duplicate slate id ${id}`);
  }

  const catalogIds = FOOTBALL_TEAM_CATALOG_V1.map((t) => t.providerTeamId);
  assert.equal(new Set(catalogIds).size, catalogIds.length);

  for (const [id, reportedName] of FOOTBALL_SLATE_2026_08_25_TEAMS) {
    const hit = resolveProviderTeam("api-football", id);
    assert.equal(hit.status, "MATCHED", `seed ${id}`);
    assert.equal(hit.canonicalTeamId, `fb-team-v1-api-football-${id}`);
    const row = FOOTBALL_TEAM_CATALOG_V1.find((t) => t.providerTeamId === id);
    assert.ok(row);
    assert.equal(row!.canonicalName, reportedName);
    assert.equal(row!.source, SCHEDULE_REL);
    assert.equal(row!.provider, "api-football");
  }

  for (const id of ALREADY_CATALOGED) {
    const hit = resolveProviderTeam("api-football", id);
    assert.equal(hit.status, "MATCHED", `existing ${id}`);
    assert.equal(hit.canonicalTeamId, `fb-team-v1-api-football-${id}`);
  }

  assert.equal(
    resolveProviderTeam("api-football", "2762", "Jeju United").status,
    "MATCHED",
  );
  assert.equal(
    resolveProviderTeam("api-football", "2761", "Incheon United").status,
    "MATCHED",
  );
  const jeonbukObserved = resolveProviderTeam(
    "api-football",
    "2762",
    "Jeonbuk Motors",
  );
  assert.equal(jeonbukObserved.status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(jeonbukObserved.canonicalTeamId, null);
  assert.ok(jeonbukObserved.reasons.includes("PROVIDER_TEAM_NAME_CONFLICT"));
  assert.ok(jeonbukObserved.reasons.includes("PROVIDER_TEAM_ID:2762"));
  assert.ok(jeonbukObserved.reasons.includes("CATALOG_NAME:Jeju United"));
  assert.ok(jeonbukObserved.reasons.includes("OBSERVED_NAME:Jeonbuk Motors"));
  const jejuOnIncheon = resolveProviderTeam(
    "api-football",
    "2761",
    "Jeju United FC",
  );
  assert.equal(jejuOnIncheon.status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(jejuOnIncheon.canonicalTeamId, null);
  assert.ok(jejuOnIncheon.reasons.includes("PROVIDER_TEAM_NAME_CONFLICT"));
  assert.ok(jejuOnIncheon.reasons.includes("PROVIDER_TEAM_ID:2761"));
  assert.ok(jejuOnIncheon.reasons.includes("CATALOG_NAME:Incheon United"));
  assert.ok(jejuOnIncheon.reasons.includes("OBSERVED_NAME:Jeju United FC"));
  assert.equal(
    FOOTBALL_TEAM_CATALOG_V1.find((t) => t.providerTeamId === "2762")
      ?.canonicalName,
    "Jeju United",
  );
  assert.equal(
    FOOTBALL_TEAM_CATALOG_V1.find((t) => t.providerTeamId === "2761")
      ?.canonicalName,
    "Incheon United",
  );

  const gimcheonExisting = resolveProviderTeam(
    "api-football",
    EXISTING_GIMCHEON_ID,
  );
  assert.equal(gimcheonExisting.status, "MATCHED");
  assert.equal(
    gimcheonExisting.canonicalTeamId,
    "fb-team-v1-api-football-7002",
  );
  const withheldGimcheon = resolveProviderTeam(
    "api-football",
    WITHHELD_GIMCHEON_ID,
  );
  assert.equal(withheldGimcheon.status, "IDENTITY_REVIEW_REQUIRED");
  assert.ok(withheldGimcheon.reasons.includes("UNKNOWN_PROVIDER_TEAM_ID"));
  assert.equal(withheldGimcheon.canonicalTeamId, null);

  assert.equal(FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has(BLOCKED_ID), true);
  const blocked2764 = resolveProviderTeam("api-football", BLOCKED_ID);
  assert.equal(blocked2764.status, "IDENTITY_REVIEW_REQUIRED");
  assert.ok(blocked2764.reasons.includes("K_LEAGUE_PROVIDER_ID_CONFLICT"));
  assert.ok(blocked2764.reasons.includes(`BLOCKED_PROVIDER_TEAM_ID:${BLOCKED_ID}`));

  const existing = JSON.parse(
    readFileSync(path.join(process.cwd(), SCHEDULE_REL), "utf8"),
  ) as FootballScheduleArtifactV1;
  assert.equal(existing.rows.length, 8);
  assert.equal(existing.meta.identityMatched, 6);
  assert.equal(existing.meta.identityBlocked, 2);
  assert.equal(existing.meta.formatEligible, 6);
  const matchIdsBefore = existing.rows.map((r) => r.matchId);
  for (const row of existing.rows) {
    assert.equal(row.matchId, `soccer-api-football-${row.providerMatchId}`);
    assert.equal(row.provider, "api-football");
  }

  const rejoined = rejoinFootballScheduleArtifact({
    existing,
    generatedAt: "2026-08-24T02:40:00.000Z",
  });
  assert.equal(rejoined.rows.length, 8);
  assert.deepEqual(
    rejoined.rows.map((r) => r.matchId),
    [...matchIdsBefore].sort((a, b) => a.localeCompare(b)),
  );

  const matched = rejoined.rows.filter((r) => r.identityStatus === "MATCHED");
  const blockedRows = rejoined.rows.filter(
    (r) => r.identityStatus === "IDENTITY_REVIEW_REQUIRED",
  );
  assert.equal(matched.length, 6);
  assert.equal(blockedRows.length, 2);
  assert.deepEqual(
    blockedRows.map((r) => r.matchId).sort(),
    [...BLOCKED_MATCH_IDS],
  );
  assert.deepEqual(
    matched.map((r) => r.matchId).sort(),
    [...ELIGIBLE_MATCH_IDS],
  );
  assert.equal(rejoined.meta.identityMatched, 6);
  assert.equal(rejoined.meta.identityBlocked, 2);
  assert.equal(rejoined.meta.formatEligible, 6);
  assert.equal(rejoined.meta.formatNotSupported, 0);

  const blocked1507040 = blockedRows.find(
    (r) => r.providerMatchId === "1507040",
  );
  assert.ok(blocked1507040);
  assert.equal(blocked1507040!.homeProviderTeamId, WITHHELD_GIMCHEON_ID);
  assert.equal(blocked1507040!.homeTeamId, null);
  assert.equal(blocked1507040!.awayTeamId, null);
  assert.equal(blocked1507040!.awayTeamName, "Jeonbuk Motors");
  assert.equal(blocked1507040!.predictionEligibility, "IDENTITY_BLOCKED");
  assert.ok(
    blocked1507040!.identityReasons.includes("UNKNOWN_PROVIDER_TEAM_ID"),
  );
  assert.ok(
    blocked1507040!.identityReasons.includes("PROVIDER_TEAM_NAME_CONFLICT"),
  );
  assert.ok(blocked1507040!.identityReasons.includes("PROVIDER_TEAM_ID:2762"));
  assert.ok(blocked1507040!.identityReasons.includes("CATALOG_NAME:Jeju United"));
  assert.ok(
    blocked1507040!.identityReasons.includes("OBSERVED_NAME:Jeonbuk Motors"),
  );

  const blocked1507041 = blockedRows.find(
    (r) => r.providerMatchId === "1507041",
  );
  assert.ok(blocked1507041);
  assert.equal(blocked1507041!.homeProviderTeamId, "2761");
  assert.equal(blocked1507041!.homeTeamId, null);
  assert.equal(blocked1507041!.homeTeamName, "Jeju United FC");
  assert.equal(blocked1507041!.awayProviderTeamId, BLOCKED_ID);
  assert.equal(blocked1507041!.awayTeamId, null);
  assert.equal(blocked1507041!.predictionEligibility, "IDENTITY_BLOCKED");
  assert.ok(
    blocked1507041!.identityReasons.includes("K_LEAGUE_PROVIDER_ID_CONFLICT"),
  );
  assert.ok(
    blocked1507041!.identityReasons.includes("PROVIDER_TEAM_NAME_CONFLICT"),
  );
  assert.ok(blocked1507041!.identityReasons.includes("PROVIDER_TEAM_ID:2761"));
  assert.ok(
    blocked1507041!.identityReasons.includes("CATALOG_NAME:Incheon United"),
  );
  assert.ok(
    blocked1507041!.identityReasons.includes("OBSERVED_NAME:Jeju United FC"),
  );

  for (const row of matched) {
    assert.equal(row.predictionEligibility, "ELIGIBLE_FORMAT");
    assert.equal(
      row.homeTeamId,
      `fb-team-v1-api-football-${row.homeProviderTeamId}`,
    );
    assert.equal(
      row.awayTeamId,
      `fb-team-v1-api-football-${row.awayProviderTeamId}`,
    );
  }

  const intake = JSON.parse(
    readFileSync(path.join(process.cwd(), INTAKE_REL), "utf8"),
  ) as IntakeArtifact;
  assert.equal(intake.meta.artifactHash, INTAKE_ARTIFACT_HASH);

  const approvedBridge = [
    { matchId: "1550087", canonical: "fb-team-v1-api-football-497", side: "home" as const },
    { matchId: "1550087", canonical: "fb-team-v1-api-football-502", side: "away" as const },
    { matchId: "1550089", canonical: "fb-team-v1-api-football-500", side: "home" as const },
    { matchId: "1550089", canonical: "fb-team-v1-api-football-487", side: "away" as const },
    { matchId: "1557376", canonical: "fb-team-v1-api-football-36", side: "home" as const },
    { matchId: "1557376", canonical: "fb-team-v1-api-football-49", side: "away" as const },
    { matchId: "1570349", canonical: "fb-team-v1-api-football-535", side: "home" as const },
    { matchId: "1570350", canonical: "fb-team-v1-api-football-727", side: "home" as const },
    { matchId: "1507042", canonical: "fb-team-v1-api-football-2766", side: "home" as const },
    { matchId: "1507042", canonical: "fb-team-v1-api-football-2745", side: "away" as const },
  ];
  for (const spec of approvedBridge) {
    const row = intakeRow(intake, spec.matchId);
    const event =
      spec.matchId === "1507042"
        ? row.candidateEvents.find(
            (e) =>
              e.homeTeamExact === "FC Seoul" &&
              e.awayTeamExact === "Bucheon FC 1995",
          )
        : row.candidateEvents[0];
    assert.ok(event);
    const exact =
      spec.side === "home" ? event!.homeTeamExact : event!.awayTeamExact;
    assert.deepEqual(getOddsTeamNames(spec.canonical), [exact]);
    assert.equal(oddsNameMatchesCanonical(exact, spec.canonical), true);
  }

  const malagaExact = intakeRow(intake, "1570349").candidateEvents[0]!.homeTeamExact;
  assert.equal(malagaExact, "Málaga");
  assert.equal(oddsNameMatchesCanonical("Malaga", "fb-team-v1-api-football-535"), false);
  assert.equal(
    oddsNameMatchesCanonical("Málaga", "fb-team-v1-api-football-535"),
    true,
  );
  const osasunaExact = intakeRow(intake, "1570350").candidateEvents[0]!.homeTeamExact;
  assert.equal(osasunaExact, "CA Osasuna");
  assert.equal(
    oddsNameMatchesCanonical("Osasuna", "fb-team-v1-api-football-727"),
    false,
  );

  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-544"), [
    "Deportivo La Coruña",
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-539"), ["Levante"]);
  assert.equal(getOddsTeamNames("fb-team-v1-api-football-2768").length, 0);
  assert.equal(getOddsTeamNames("fb-team-v1-api-football-2761").length, 0);
  assert.equal(getOddsTeamNames("fb-team-v1-api-football-2762").length, 0);
  assert.equal(getOddsTeamNames("fb-team-v1-api-football-2764").length, 0);
  for (const id of [
    "fb-team-v1-api-football-2768",
    "fb-team-v1-api-football-2761",
    "fb-team-v1-api-football-2762",
    "fb-team-v1-api-football-2764",
  ] as const) {
    assert.equal(
      FOOTBALL_ODDS_TEAM_BRIDGE_V1.some((e) => e.canonicalTeamId === id),
      false,
      id,
    );
  }

  const approvedCanonicals = [
    "fb-team-v1-api-football-497",
    "fb-team-v1-api-football-502",
    "fb-team-v1-api-football-500",
    "fb-team-v1-api-football-487",
    "fb-team-v1-api-football-36",
    "fb-team-v1-api-football-49",
    "fb-team-v1-api-football-535",
    "fb-team-v1-api-football-727",
    "fb-team-v1-api-football-2766",
    "fb-team-v1-api-football-2745",
  ] as const;
  for (const id of approvedCanonicals) {
    const entry = FOOTBALL_ODDS_TEAM_BRIDGE_V1.find(
      (e) => e.canonicalTeamId === id,
    );
    assert.ok(entry, id);
    assert.equal(entry!.verifiedAt, MANUAL_REVIEW_2026_08_25_VERIFIED_AT, id);
    assert.notEqual(entry!.verifiedAt, INTAKE_2026_08_25_OBSERVED_AT, id);
  }

  const audit = JSON.parse(
    readFileSync(
      path.join(
        process.cwd(),
        "data/audits/2026-08-25-football-identity-bridge-review-v1.json",
      ),
      "utf8",
    ),
  ) as {
    candidateObservedAt: string;
    manualReviewedAt: string;
    reviewMethod: string;
    fcSeoulBucheon: { promotionClass: string; autoApproveForbidden: boolean };
  };
  assert.equal(audit.candidateObservedAt, INTAKE_2026_08_25_OBSERVED_AT);
  assert.equal(audit.manualReviewedAt, MANUAL_REVIEW_2026_08_25_VERIFIED_AT);
  assert.notEqual(audit.candidateObservedAt, audit.manualReviewedAt);
  assert.equal(audit.reviewMethod, "MANUAL_EVENT_IDENTITY_REVIEW");
  assert.equal(
    audit.fcSeoulBucheon.promotionClass,
    "MANUAL_EVENT_IDENTITY_REVIEW",
  );
  assert.equal(audit.fcSeoulBucheon.autoApproveForbidden, true);

  assertOddsTeamBridgeIntegrity(FOOTBALL_ODDS_TEAM_BRIDGE_V1);
  const canonicals = FOOTBALL_ODDS_TEAM_BRIDGE_V1.map((e) => e.canonicalTeamId);
  assert.equal(canonicals.length, new Set(canonicals).size);
  const names = FOOTBALL_ODDS_TEAM_BRIDGE_V1.flatMap((e) => e.oddsTeamNames);
  assert.equal(names.length, new Set(names).size);

  const firstOdds = JSON.parse(
    readFileSync(path.join(process.cwd(), ODDS_REL), "utf8"),
  ) as {
    meta: {
      artifactHash: string;
      scheduleEligibleGames: number;
      providerCalled: boolean;
      sourceScheduleArtifactHash: string;
    };
    observations: unknown[];
  };
  assert.equal(firstOdds.meta.artifactHash, FIRST_ODDS_ARTIFACT_HASH);
  assert.equal(firstOdds.meta.sourceScheduleArtifactHash, FIRST_ODDS_SCHEDULE_HASH);
  assert.equal(firstOdds.meta.scheduleEligibleGames, 0);
  assert.equal(firstOdds.meta.providerCalled, false);
  assert.equal(firstOdds.observations.length, 0);
  assert.equal(sha256File(ODDS_REL).length, 64);
  assert.equal(sha256File(INTAKE_REL).length, 64);

  const isolationDiff = execSync(
    `git diff --name-only -- ${ISOLATION_PATHS.join(" ")}`,
    { cwd: process.cwd(), encoding: "utf8" },
  ).trim();
  assert.equal(isolationDiff, "");

  console.log("PASS football-2026-08-25-identity-v1");
}

main();
