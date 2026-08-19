/**
 * Football 2026-27 Big-5 Opening Readiness Audit v1.
 * Static + existing-artifact only. No Provider / Prediction / Result calls.
 *
 *   npm run audit:football-opening-readiness-v1
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FOOTBALL_COMPETITION_PROFILES_V1,
  getCompetitionProfileById,
} from "../src/lib/football/competition/profiles";
import { FOOTBALL_COMPETITION_REGISTRY_V0 } from "../src/lib/football/foundation/competition-registry";
import { FOOTBALL_TEAM_CATALOG_V1 } from "../src/lib/football/core/team-catalog";
import {
  FOOTBALL_SLATE_2026_08_17_TEAMS,
  FOOTBALL_SLATE_2026_08_18_TEAMS,
} from "../src/lib/football/core/team-catalog-slate-2026-08";
import { FOOTBALL_ODDS_SPORT_KEY_MAP_V1 } from "../src/lib/football/odds-1x2-v1/sport-keys";
import { FOOTBALL_ODDS_TEAM_BRIDGE_V1 } from "../src/lib/football/odds-1x2-v1/team-bridge";
import { TEAM_ALIASES } from "../src/lib/teams/team-aliases";

export const AUDIT_REL = "data/audits/football-2026-27-opening-readiness-v1.json";
export const SCHEMA = "yang-edge-football-opening-readiness-v1";

const FROZEN = {
  prediction: "data/predictions/mlb/2026-08-20.json",
  freezeClose: "data/audits/2026-08-20-pregame-freeze-close-v1.json",
  inputClose: "data/audits/2026-08-20-pregame-input-close-v1.json",
  scopeLock: "data/audits/2026-08-20-daily-scope-lock-v1.json",
  footballSchedule: "data/research/football/2026-08-20-schedule-v1.json",
  confirmed:
    "data/operator-input/mlb/2026-08-20-confirmed-lineup-observation-v0.json",
  expected:
    "data/operator-input/mlb/2026-08-20-expected-lineup-observation-v0.json",
} as const;

export type GateStatus = "READY" | "PARTIAL" | "BLOCKED" | "NOT_PROVEN";
export type GateId =
  | "config"
  | "schedule"
  | "identity"
  | "odds"
  | "freeze"
  | "prediction"
  | "result"
  | "gradeReview";

type LeagueKey = "EPL" | "LA_LIGA" | "SERIE_A" | "BUNDESLIGA" | "LIGUE_1";

const TARGETS: Array<{
  key: LeagueKey;
  competitionId: string;
  operatorAliasLeague: string;
  knownProviderTeamIds: string[];
}> = [
  {
    key: "EPL",
    competitionId: "fb-comp-api-football-39",
    operatorAliasLeague: "프리미어리그",
    knownProviderTeamIds: ["33", "40", "50", "42"],
  },
  {
    key: "LA_LIGA",
    competitionId: "fb-comp-api-football-140",
    operatorAliasLeague: "라리가",
    knownProviderTeamIds: [
      "541",
      "529",
      ...FOOTBALL_SLATE_2026_08_17_TEAMS.map(([id]) => id),
      ...FOOTBALL_SLATE_2026_08_18_TEAMS.map(([id]) => id),
    ],
  },
  {
    key: "SERIE_A",
    competitionId: "fb-comp-api-football-135",
    operatorAliasLeague: "세리에 A",
    knownProviderTeamIds: [],
  },
  {
    key: "BUNDESLIGA",
    competitionId: "fb-comp-api-football-78",
    operatorAliasLeague: "분데스리가",
    knownProviderTeamIds: ["157"],
  },
  {
    key: "LIGUE_1",
    competitionId: "fb-comp-api-football-61",
    operatorAliasLeague: "리그 1",
    knownProviderTeamIds: [],
  },
];

export function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function gate(
  max: number,
  score: number,
  status: GateStatus,
  evidence: string[],
  blockers: string[] = [],
) {
  if (score < 0 || score > max) {
    throw new Error(`GATE_SCORE_OUT_OF_RANGE:${score}/${max}`);
  }
  return { max, score, status, evidence, blockers };
}

function walkJson(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkJson(abs, suffix));
    else if (ent.name.endsWith(suffix)) out.push(abs);
  }
  return out;
}

export function buildFootballOpeningReadinessAudit(cwd: string) {
  const generatedAt = new Date().toISOString();
  const frozenHashes = Object.fromEntries(
    Object.entries(FROZEN).map(([k, rel]) => [
      k,
      { rel, sha256: sha256File(path.join(cwd, rel)) },
    ]),
  );

  const scheduleFiles = walkJson(
    path.join(cwd, "data/research/football"),
    "-schedule-v1.json",
  );
  const schedulePresence: Record<string, string[]> = {};
  for (const t of TARGETS) schedulePresence[t.competitionId] = [];
  for (const abs of scheduleFiles) {
    const doc = JSON.parse(readFileSync(abs, "utf8")) as {
      meta?: { dateKst?: string };
      rows?: Array<{ competitionId?: string }>;
    };
    const dateKst = doc.meta?.dateKst ?? path.basename(abs);
    const ids = new Set((doc.rows ?? []).map((r) => r.competitionId));
    for (const t of TARGETS) {
      if (ids.has(t.competitionId)) {
        schedulePresence[t.competitionId]!.push(dateKst);
      }
    }
  }

  const catalogByProvider = new Map(
    FOOTBALL_TEAM_CATALOG_V1.map((t) => [t.providerTeamId, t]),
  );
  const oddsBridgeIds = new Set(
    FOOTBALL_ODDS_TEAM_BRIDGE_V1.map((e) =>
      e.canonicalTeamId.replace("fb-team-v1-api-football-", ""),
    ),
  );

  const ucl = getCompetitionProfileById("fb-comp-api-football-2");
  const uel = getCompetitionProfileById("fb-comp-api-football-3");

  const leagues = TARGETS.map((t) => {
    const profile = getCompetitionProfileById(t.competitionId);
    if (!profile) throw new Error(`PROFILE_MISSING:${t.competitionId}`);
    const v0 = FOOTBALL_COMPETITION_REGISTRY_V0.find(
      (c) => c.competitionId === t.competitionId,
    );
    const sport = FOOTBALL_ODDS_SPORT_KEY_MAP_V1.find(
      (e) => e.competitionId === t.competitionId,
    );
    const uniqueIds = [...new Set(t.knownProviderTeamIds)];
    const catalogTeams = uniqueIds.filter((id) => catalogByProvider.has(id));
    const missingCatalog = uniqueIds.filter((id) => !catalogByProvider.has(id));
    const operatorAliases = TEAM_ALIASES.filter(
      (a) => a.sport === "football" && a.league === t.operatorAliasLeague,
    );
    const oddsBridged = catalogTeams.filter((id) => oddsBridgeIds.has(id));
    const scheduleDates = schedulePresence[t.competitionId] ?? [];
    const hasLaLigaFullChain = t.key === "LA_LIGA";

    const config = gate(
      10,
      10,
      "READY",
      [
        `profile ${profile.competitionId} providerCompetitionId=${profile.providerCompetitionId}`,
        `defaultMatchFormat=${profile.defaultMatchFormat}`,
        `predictionEligibility=${profile.predictionEligibility}`,
        `seasonIdAuthoritative=${profile.seasonIdAuthoritative}`,
        `foundationRegistrySeasonTag=${v0?.season ?? "MISSING"}`,
      ],
      v0 && v0.season === "2025"
        ? [
            "FOUNDATION_REGISTRY_SEASON_TAG_2025_UNUSED_BY_SCHEDULE_BUT_STALE_FOR_2026_27",
          ]
        : [],
    );

    const schedule = scheduleDates.length
      ? gate(
          15,
          t.key === "LA_LIGA" ? 15 : 12,
          t.key === "LA_LIGA" ? "READY" : "PARTIAL",
          [
            "builder filters by competition profile + date fetch; matchId=soccer-api-football-{fixtureId}",
            `recentScheduleDates=${scheduleDates.sort().join(",")}`,
            "tests: test:football-schedule-v1",
          ],
        )
      : gate(
          15,
          12,
          "PARTIAL",
          [
            "builder + tests support this providerCompetitionId",
            "no recent football-schedule-v1 row for this competitionId (summer slate / not collected)",
          ],
        );

    let identityScore = 2;
    let identityStatus: GateStatus = "BLOCKED";
    if (catalogTeams.length >= 5 && oddsBridged.length >= 4) {
      identityScore = 10;
      identityStatus = "PARTIAL";
    } else if (catalogTeams.length >= 4) {
      identityScore = 6;
      identityStatus = "PARTIAL";
    } else if (catalogTeams.length >= 1) {
      identityScore = catalogTeams.length >= 2 ? 4 : 3;
      identityStatus = "BLOCKED";
    }
    if (t.key === "LA_LIGA") {
      identityScore = 10;
      identityStatus = "PARTIAL";
    }
    const identity = gate(
      20,
      identityScore,
      identityStatus,
      [
        `canonicalRegisteredFromKnownIds=${catalogTeams.length}`,
        `providerIdsKnown=${uniqueIds.length}`,
        `operatorAliasEntries=${operatorAliases.length}`,
        `oddsBridgeOverlap=${oddsBridged.length}`,
        `missingKnownIds=${missingCatalog.join(",") || "none"}`,
        "resolveProviderTeam is provider-ID only; no fuzzy name guessing",
        "seasonTeamCount=NOT_PROVEN",
      ],
      catalogTeams.length === 0
        ? ["ZERO_CANONICAL_TEAMS_EVERY_MATCH_IDENTITY_BLOCKED"]
        : [
            "CATALOG_NOT_LEAGUE_COMPLETE",
            ...(t.key === "LA_LIGA"
              ? ["2026-08-20 Atletico Madrid 530 / Malaga 535 UNKNOWN_PROVIDER_TEAM_ID"]
              : []),
          ],
    );

    const oddsLiveLaLiga = t.key === "LA_LIGA";
    const odds = gate(
      20,
      oddsLiveLaLiga ? 14 : sport ? 6 : 0,
      oddsLiveLaLiga ? "PARTIAL" : sport ? "PARTIAL" : "BLOCKED",
      [
        `sportKey=${sport?.sportKey ?? "UNMAPPED"}`,
        `sportKeySource=${sport?.source ?? "none"}`,
        `oddsBridgeCount=${oddsBridged.length}`,
        "1X2 complete market + pregame cutoff exist in odds-1x2-v1 (common)",
        oddsLiveLaLiga
          ? "evidence: 2026-08-18-1x2-odds-v1.json joinedGames=1 sportKey=soccer_spain_la_liga"
          : "no league-specific odds join artifact; historical sport-key coverageStatus=DOCUMENTED_AVAILABLE_NOT_PROBED",
      ],
      sport && oddsBridged.length === 0
        ? ["SPORT_KEY_MAPPED_BUT_ODDS_TEAM_BRIDGE_EMPTY"]
        : oddsBridged.length
          ? ["ODDS_TEAM_BRIDGE_PARTIAL_NOT_FULL_LEAGUE"]
          : [],
    );

    const freeze = gate(
      10,
      10,
      "READY",
      [
        "common: prediction-snapshot-v0 consumes Schedule+Odds only",
        "late odds rejected: observedAt > freezeAt or >= kickoff",
        "immutable snapshotHash",
        "tests: test:football-prediction-snapshot-v0",
        hasLaLigaFullChain
          ? "evidence: 2026-08-18-prediction-snapshot-v0.json frozenGames=1"
          : "league-agnostic contract; La Liga/J1 artifacts prove the shared freeze path",
      ],
    );

    const prediction = gate(
      10,
      10,
      "READY",
      [
        "predictionClass=MARKET_BASELINE",
        "engine=NONE officialPickCount=0",
        "consumes frozen snapshot only",
        "PASS/BLOCKED via baselineStatus / snapshotStatus accounting",
        "tests: test:football-market-baseline-prediction-v0",
      ],
    );

    const result = gate(
      10,
      oddsLiveLaLiga ? 9 : 7,
      oddsLiveLaLiga ? "PARTIAL" : "PARTIAL",
      [
        "official-result-v0 joins by provider fixture ID",
        "marketSettlement=REGULATION_90_MINUTES_1X2",
        "ET/PEN separated; 1X2 from score.fulltime only",
        "selectOfficialResultTargetRows requires ELIGIBLE_FORMAT",
        oddsLiveLaLiga
          ? "evidence: 2026-08-18-official-result-v0.json FINAL 1-1 DRAW"
          : "no league-specific official-result artifact",
      ],
      ["IDENTITY_BLOCKED_ROWS_ARE_DROPPED_FROM_RESULT_COLLECTION"],
    );

    const gradeReview = gate(
      5,
      4,
      "PARTIAL",
      [
        "gradeFootballOneXTwo DRAW first-class; prediction snapshot not mutated",
        "path: research:football-postgame-review → review + scorecard",
        "artifacts: 2026-08-18-market-baseline-review-v0.json / scorecard (insufficientSample=true)",
        "no separate Success Review / Failure Review products",
      ],
    );

    const gates = {
      config,
      schedule,
      identity,
      odds,
      freeze,
      prediction,
      result,
      gradeReview,
    };
    const total = Object.values(gates).reduce((s, g) => s + g.score, 0);
    const status: GateStatus =
      total >= 90 && identity.status === "READY" && odds.status === "READY"
        ? "READY"
        : identity.status === "BLOCKED" && catalogTeams.length === 0
          ? "BLOCKED"
          : "PARTIAL";
    const goNoGo =
      catalogTeams.length === 0
        ? "GO_WITH_BLOCKERS"
        : "GO_WITH_BLOCKERS";

    return {
      league: t.key,
      competitionId: t.competitionId,
      canonicalName: profile.canonicalName,
      displayNameKo: profile.displayNameKo,
      provider: profile.provider,
      providerCompetitionId: profile.providerCompetitionId,
      competitionType: profile.competitionType,
      defaultMatchFormat: profile.defaultMatchFormat,
      seasonCalendar: profile.seasonCalendar,
      researchStatus: profile.researchStatus,
      predictionEligibility: profile.predictionEligibility,
      legalStatus: profile.legalStatus,
      foundationRegistrySeason: v0?.season ?? null,
      coverage: {
        seasonTeamCount: "NOT_PROVEN",
        canonicalRegisteredTeamCount: catalogTeams.length,
        providerTeamIdsKnown: uniqueIds.length,
        operatorAliasCount: operatorAliases.length,
        oddsBridgeCount: oddsBridged.length,
        catalogProviderTeamIds: catalogTeams,
        operatorAliasNames: operatorAliases.map((a) => a.displayName),
        oddsBridgedProviderTeamIds: oddsBridged,
      },
      oddsSportKey: sport?.sportKey ?? null,
      oddsSportKeySource: sport?.source ?? null,
      oddsTeamBridgeStatus:
        oddsBridged.length === 0
          ? "NONE"
          : oddsBridged.length < 10
            ? "PARTIAL"
            : "FULL",
      gates,
      total,
      status,
      goNoGo,
    };
  });

  const totals = leagues.map((l) => l.total);
  const avg = Math.round((totals.reduce((a, b) => a + b, 0) / leagues.length) * 10) / 10;
  const lowest = leagues.reduce((a, b) => (a.total <= b.total ? a : b));
  const highest = leagues.reduce((a, b) => (a.total >= b.total ? a : b));

  const document = {
    schemaVersion: SCHEMA,
    generatedAt,
    researchOnly: true,
    network: {
      providerCalls: 0,
      apiFootball: 0,
      theOddsApi: 0,
      resultProvider: 0,
    },
    predictionCalls: 0,
    engineCalls: 0,
    frozenArtifactMutations: 0,
    mandatoryCompletion: {
      dateKst: "2026-08-20",
      total: "60%",
      supplementalMissionEffect: "0%",
    },
    frozenHashesBefore: frozenHashes,
    targets: TARGETS.map((t) => t.key),
    leagues,
    openingReadinessTable: leagues.map((l) => ({
      league: l.canonicalName,
      config: l.gates.config.score,
      schedule: l.gates.schedule.score,
      identity: l.gates.identity.score,
      odds: l.gates.odds.score,
      freeze: l.gates.freeze.score,
      prediction: l.gates.prediction.score,
      result: l.gates.result.score,
      gradeReview: l.gates.gradeReview.score,
      total: l.total,
      status: l.status,
    })),
    pipelineAverage: avg,
    lowestLeague: lowest.canonicalName,
    highestLeague: highest.canonicalName,
    p0BlockerCount: 2,
    dualRegistry: {
      note: "Schedule uses competition profiles. Operator 2026-08-20 join used foundation registry v0 displayName exact match.",
      profilesIncludeMls: true,
      foundationRegistryIncludesMls: FOOTBALL_COMPETITION_REGISTRY_V0.some(
        (c) => c.providerCompetitionId === "253",
      ),
      foundationSeasonTags: FOOTBALL_COMPETITION_REGISTRY_V0.filter((c) =>
        TARGETS.some((t) => t.competitionId === c.competitionId),
      ).map((c) => ({ competitionId: c.competitionId, season: c.season })),
    },
    uclUelSideNote: {
      ucl: {
        competitionId: ucl?.competitionId,
        matchFormat: ucl?.defaultMatchFormat,
        predictionEligibility: ucl?.predictionEligibility,
        oddsSportKey: FOOTBALL_ODDS_SPORT_KEY_MAP_V1.find(
          (e) => e.competitionId === "fb-comp-api-football-2",
        )?.sportKey ?? null,
      },
      uel: {
        competitionId: uel?.competitionId,
        matchFormat: uel?.defaultMatchFormat,
        predictionEligibility: uel?.predictionEligibility,
        oddsSportKey: FOOTBALL_ODDS_SPORT_KEY_MAP_V1.find(
          (e) => e.competitionId === "fb-comp-api-football-3",
        )?.sportKey ?? null,
      },
      excludedFromBig5Scores: true,
    },
    scheduleSeasonSafety: {
      status: "RISK",
      fixtureSeasonIsScheduleSoT: true,
      hardcodedSeasonInProfiles: false,
      foundationRegistrySeasonHardcoded: "2025 for Big 5 / UCL / UEL",
      evidence: "2026-08-18 La Liga row seasonId=2026 from fixture.league.season",
      dateFetchNotSeasonFetch: true,
    },
    leakage: {
      predictionSnapshotProviderCall: false,
      marketBaselineProviderCall: false,
      predictionReadsResult: false,
      predictionReadsPostgame: false,
      lateOddsRejected: true,
      dummyProviderAdmittedAsResearch: false,
    },
    identitySafety: {
      schedulePrimaryId: "provider fixture ID → matchId soccer-api-football-{fixtureId}",
      oddsJoin: "sportKey + exact odds team names + kickoff ±15m (NOT fixture ID)",
      resultJoin: "provider fixture ID + provider team IDs",
      teamPairOnlyJoin: false,
      oddsJoinTeamPairRisk: "PRESENT_IF_SAME_TEAMS_SAME_SPORT_KEY_WITHIN_TOLERANCE",
    },
    resultSemantics: {
      league1x2: "regular 90 minutes from score.fulltime",
      extraTime: "stored separately; does not change oneXTwoOutcome",
      penalties: "stored separately; advancementWinner only",
      cupVsLeague: "UCL/UEL defaultMatchFormat=UNKNOWN → NOT_SUPPORTED_FORMAT",
    },
    gradeReviewPaths: {
      grade: {
        status: "IMPLEMENTED",
        fn: "src/lib/football/review-scorecard-foundation-v0/grade-one-x-two.ts",
        operational: "src/lib/football/market-baseline-postgame-review-v0/build.ts",
        artifact: "data/research/football/2026-08-18-market-baseline-review-v0.json",
        predictionImmutable: true,
        resultSeparate: true,
        drawSupported: true,
        passBlockedExcluded: true,
      },
      successReview: { status: "NOT_IMPLEMENTED", note: "CORRECT/INCORRECT live inside combined RESEARCH_REVIEW" },
      failureReview: { status: "NOT_IMPLEMENTED", note: "same combined review record" },
      scorecard: {
        status: "IMPLEMENTED",
        artifact: "data/research/football/2026-08-18-market-baseline-scorecard-v0.json",
        insufficientSample: true,
      },
    },
    operatorSlate2026_08_20: {
      observed: 23,
      matchedRegistered: 0,
      identityBlocked: 5,
      unregistered: 18,
      causes: {
        unregisteredMls: 15,
        unregisteredCopaLibertadores: 3,
        identityBlockedUclLabelMismatch: 4,
        identityBlockedLaLigaMissingTeamAlias: 1,
      },
      notes: [
        "Operator join used foundation registry v0 displayName exact match, not competition profiles.",
        "MLS is profiled but missing from foundation registry v0 → screenshot MLS labeled UNREGISTERED.",
        "UCL screenshot label !== registry displayName UEFA 챔피언스리그.",
        "La Liga registered; AT마드/말라가 not in TEAM_ALIASES. Schedule also IDENTITY_BLOCKED for provider 530/535.",
      ],
      big5OpeningRecurrenceRisk: "YES",
      recurrenceWhy:
        "Korean operator aliases and exact competition-label match are incomplete; catalog holes (e.g. Atletico 530) also block the research schedule path, not only screenshots.",
    },
    modelMaturity: {
      predictionClass: "MARKET_BASELINE",
      officialEngine: "NONE",
      features: ["frozen median-devig 1X2 probabilities", "renormalize to sum 1", "argmax"],
      calibration: false,
      validatedSample: {
        footballMarketBaselineGraded: 1,
        dateKst: "2026-08-18",
        matchId: "soccer-api-football-1570337",
        verdict: "INCORRECT",
        insufficientSample: true,
      },
      engineAdmission: "PROHIBITED",
      pipelineReadyIsNotModelValidated: true,
    },
    openingDayFailureModes: [
      "Unknown API-Football team ID → IDENTITY_BLOCKED (2026-08-20 Atletico 530 / Malaga 535)",
      "Canonical ID exists but Odds team bridge missing → no 1X2 join",
      "Operator screenshot league label ≠ registry displayName (UCL vs UEFA 챔피언스리그; EPL vs 프리미어리그)",
      "Operator Korean team alias missing on a registered competition",
      "Official result skips IDENTITY_BLOCKED rows (ELIGIBLE_FORMAT filter)",
      "FreezeAt >= kickoff → MISSED_SNAPSHOT_FREEZE_WINDOW",
      "Foundation registry season=2025 used as API season instead of fixture.league.season",
      "Operator join registry ≠ competition profiles (MLS profiled, operator UNREGISTERED)",
      "Odds join by team names+kickoff, not fixture ID, if two events share sport-key window",
      "UCL/UEL mixed into daily prediction slate remain NOT_SUPPORTED_FORMAT",
    ],
    blockers: {
      P0: [
        "Complete Big-5 canonical team catalog from provider team IDs (blocks ELIGIBLE_FORMAT → odds/snapshot/result)",
        "Complete Big-5 Odds team bridge after canonical IDs exist (sport-key alone cannot join)",
      ],
      P1: [
        "Operator competition-label aliases (EPL/UCL abbreviations) and Korean team aliases for screenshot slate",
        "Align foundation registry v0 with competition profiles (MLS, season tag)",
        "Live /sports re-verify EPL/Serie A/Bundesliga/Ligue 1 sport keys (currently historical NOT_PROBED except La Liga 08-18)",
      ],
      P2: [
        "Model validation beyond n=1 MARKET_BASELINE sample",
        "Separate Success/Failure Review products",
        "UCL/UEL matchFormat support",
        "legalStatus NEEDS_LEGAL_REVIEW",
      ],
    },
    recommendedNextMission:
      "Football Team Identity Catalog Completion v1 — seed provider team IDs for Premier League / La Liga / Serie A / Bundesliga / Ligue 1 so schedule rows can become ELIGIBLE_FORMAT. Odds bridge is the next gate after that.",
    leakageSafetyExpected: {
      predictionSnapshotProvider: "NO",
      marketPredictionProvider: "NO",
      resultInput: "NO",
      postgameInput: "NO",
      lateOdds: "rejected",
    },
  };

  const frozenHashesAfter = Object.fromEntries(
    Object.entries(FROZEN).map(([k, rel]) => [
      k,
      { rel, sha256: sha256File(path.join(cwd, rel)) },
    ]),
  );
  if (JSON.stringify(frozenHashesAfter) !== JSON.stringify(frozenHashes)) {
    throw new Error("FROZEN_ARTIFACT_MUTATED_DURING_AUDIT");
  }

  return {
    document: {
      ...document,
      frozenHashesAfter,
    },
  };
}

async function main() {
  const cwd = process.cwd();
  const { document } = buildFootballOpeningReadinessAudit(cwd);
  const abs = path.join(cwd, AUDIT_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`wrote ${AUDIT_REL}`);
  console.log(
    JSON.stringify(
      {
        pipelineAverage: document.pipelineAverage,
        table: document.openingReadinessTable,
        p0: document.p0BlockerCount,
        next: document.recommendedNextMission,
      },
      null,
      2,
    ),
  );
}

const invoked = process.argv[1]?.replaceAll("\\", "/").endsWith(
  "audit-football-opening-readiness-v1.ts",
);
if (invoked) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
