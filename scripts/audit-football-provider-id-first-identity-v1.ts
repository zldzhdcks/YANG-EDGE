/**
 * Football Provider-ID First Identity Gate Audit v1.
 * Existing code + existing artifacts only. No Provider / Prediction / Result calls.
 *
 *   npm run audit:football-provider-id-first-identity-v1
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS,
  FOOTBALL_TEAM_CATALOG_V1,
  FOOTBALL_TEAM_CONFLICTS_V1,
} from "../src/lib/football/core/team-catalog";
import { FOOTBALL_TEAM_REGISTRY_V0 } from "../src/lib/football/foundation/team-registry";

export const AUDIT_REL =
  "data/audits/football-provider-id-first-identity-gate-audit-v1.json";
export const SCHEMA = "yang-edge-football-provider-id-first-identity-gate-audit-v1";

export const FROZEN_REL = {
  schedule: "data/research/football/2026-08-20-schedule-v1.json",
  openingReadiness: "data/audits/football-2026-27-opening-readiness-v1.json",
  freezeClose: "data/audits/2026-08-20-pregame-freeze-close-v1.json",
} as const;

const SCHEDULE_DATES = [
  "2026-08-12",
  "2026-08-14",
  "2026-08-16",
  "2026-08-17",
  "2026-08-18",
  "2026-08-20",
] as const;

const STAGES = [
  "Schedule",
  "Operator Join",
  "Odds",
  "Pregame Snapshot",
  "Market Baseline Prediction",
  "Official Result",
  "Grade",
  "Review",
  "Scorecard",
] as const;

type ScheduleRow = {
  matchId: string;
  provider: string;
  providerMatchId: string;
  competitionId: string;
  seasonId: string | null;
  homeProviderTeamId: string;
  awayProviderTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTimeUtc: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  identityStatus: string;
  identityReasons: string[];
  predictionEligibility: string;
};

type ScheduleDoc = {
  meta: {
    identityVersion?: string;
    identityMatched?: number;
    identityBlocked?: number;
    scheduleGames?: number;
    artifactHash?: string;
  };
  rows: ScheduleRow[];
};

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function readJson<T>(abs: string): T {
  return JSON.parse(readFileSync(abs, "utf8")) as T;
}

function fileContains(cwd: string, rel: string, needle: string): boolean {
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return false;
  return readFileSync(abs, "utf8").includes(needle);
}

function providerIdentityComplete(row: ScheduleRow): boolean {
  return Boolean(
    row.provider &&
      String(row.providerMatchId ?? "").trim() &&
      String(row.competitionId ?? "").trim() &&
      String(row.seasonId ?? "").trim() &&
      String(row.kickoffTimeUtc ?? "").trim() &&
      String(row.homeProviderTeamId ?? "").trim() &&
      String(row.awayProviderTeamId ?? "").trim(),
  );
}

function catalogHit(provider: string, providerTeamId: string): boolean {
  return FOOTBALL_TEAM_CATALOG_V1.some(
    (t) => t.provider === provider && t.providerTeamId === providerTeamId,
  );
}

function classifyHypothetical(row: ScheduleRow): {
  bucket:
    | "PROVIDER_IDENTIFIED"
    | "CANONICAL_ENRICHMENT_PENDING"
    | "INVALID_PROVIDER_IDENTITY";
  note: string;
} {
  if (!providerIdentityComplete(row)) {
    return {
      bucket: "INVALID_PROVIDER_IDENTITY",
      note: "missing provider fixture and/or participant fields",
    };
  }
  const homeBlocked = FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has(
    row.homeProviderTeamId,
  );
  const awayBlocked = FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has(
    row.awayProviderTeamId,
  );
  const homeKnown = catalogHit(row.provider, row.homeProviderTeamId);
  const awayKnown = catalogHit(row.provider, row.awayProviderTeamId);
  if (homeBlocked || awayBlocked) {
    return {
      bucket: "CANONICAL_ENRICHMENT_PENDING",
      note: "provider IDs present but locally blocked (K League conflict denylist)",
    };
  }
  if (homeKnown && awayKnown) {
    return {
      bucket: "PROVIDER_IDENTIFIED",
      note: "provider fixture complete and both teams already catalog-matched",
    };
  }
  return {
    bucket: "CANONICAL_ENRICHMENT_PENDING",
    note: "provider fixture complete; one or both teams lack catalog enrichment",
  };
}

function loadSchedule(cwd: string, dateKst: string): ScheduleDoc | null {
  const rel = `data/research/football/${dateKst}-schedule-v1.json`;
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return null;
  return readJson<ScheduleDoc>(abs);
}

function scanCallGraph(cwd: string) {
  const scheduleBuilder = "src/lib/football/core/build-schedule.ts";
  const identity = "src/lib/football/core/identity.ts";
  const normalize = "src/lib/football/core/normalize.ts";
  const catalog = "src/lib/football/core/team-catalog.ts";
  const foundationGate = "src/lib/football/foundation/identity-gate.ts";
  const foundationRegistry = "src/lib/football/foundation/team-registry.ts";
  const matchId = "src/lib/football/foundation/match-identity.ts";
  const resultBuild = "src/lib/football/official-result-v0/build.ts";
  const oddsBuild = "src/lib/football/odds-1x2-v1/build.ts";
  const oddsJoin = "src/lib/football/odds-1x2-v1/event-join.ts";
  const snapshotBuild = "src/lib/football/prediction-snapshot-v0/build.ts";
  const operatorJoin = "scripts/audit-2026-08-20-operator-scope-join-v1.ts";
  const identityTest = "scripts/test-football-identity-foundation-v0.ts";

  const scheduleImportsFoundationGate = fileContains(
    cwd,
    scheduleBuilder,
    "evaluateFootballIdentityGate",
  );
  const identityUsesCatalog = fileContains(
    cwd,
    identity,
    "resolveProviderTeam",
  );
  const normalizeUsesMatchId = fileContains(
    cwd,
    normalize,
    "buildFootballMatchId",
  );
  const resultFiltersEligible = fileContains(
    cwd,
    resultBuild,
    'row.predictionEligibility === "ELIGIBLE_FORMAT"',
  );
  const resultRequiresCanonical = fileContains(
    cwd,
    resultBuild,
    "FOOTBALL_OFFICIAL_RESULT_SCHEDULE_TEAM_ID_MISSING",
  );
  const resultFetchesByFixtureId = fileContains(
    cwd,
    resultBuild,
    "getFixtureById",
  );

  return {
    scheduleActualSoT: "src/lib/football/core/team-catalog.ts#resolveProviderTeam",
    scheduleResolver: "src/lib/football/core/identity.ts#resolveScheduleIdentityFields",
    identityVersionInProductionSchedule: "football-core-identity-v1",
    foundationIdentityGateUsedByCurrentSchedule: false,
    coreTeamCatalogUsedByCurrentSchedule: true,
    duplicateSoT: false,
    duplicateIdentitySystems: true,
    notes: [
      "Production Schedule builder is src/lib/football/core/build-schedule.ts → normalizeFixtureToScheduleRow → resolveScheduleIdentityFields → resolveProviderTeam.",
      "evaluateFootballIdentityGate is not imported by the Schedule builder. Runtime consumers found: foundation/index.ts snapshot + scripts/test-football-identity-foundation-v0.ts only.",
      "foundation/team-registry.ts comment: 'Minimal seed for Foundation gate tests / wiring. Production expansion is a separate data mission'.",
      "core/team-catalog.ts is the blocking allowlist for MATCHED vs IDENTITY_REVIEW_REQUIRED on operational football-schedule-v1 rows.",
      "Two identity lists exist; only the core catalog blocks current research Schedule. Duplicate lists, not duplicate Schedule SoT.",
      "foundation/schedule-artifact-contract.ts comment says callers must pass Identity Gate; that v0 envelope is not the operational football-schedule-v1 writer.",
      "Document/code comment vs runtime: foundation gate comments overstate production authority. Operational SoT is core identity v1.",
    ],
    evidence: {
      scheduleBuilder,
      identity,
      normalize,
      catalog,
      foundationGate,
      foundationRegistry,
      matchId,
      resultBuild,
      oddsBuild,
      oddsJoin,
      snapshotBuild,
      operatorJoin,
      identityTest,
      scheduleImportsFoundationGate,
      identityUsesCatalog,
      normalizeUsesMatchId,
      resultFiltersEligible,
      resultRequiresCanonical,
      resultFetchesByFixtureId,
      foundationGateImportedByScheduleBuilder: scheduleImportsFoundationGate,
      catalogImportedByIdentity: identityUsesCatalog,
    },
  };
}

function providerIdStability(cwd: string) {
  const nameToIds = new Map<string, Set<string>>();
  const idToNames = new Map<string, Set<string>>();
  const nameDateExamples = new Map<
    string,
    Array<{ dateKst: string; fixtureId: string; providerTeamId: string }>
  >();
  const fixtureIds = new Map<string, string[]>();
  const scannedDates: string[] = [];
  const missingDates: string[] = [];

  for (const dateKst of SCHEDULE_DATES) {
    const doc = loadSchedule(cwd, dateKst);
    if (!doc) {
      missingDates.push(dateKst);
      continue;
    }
    scannedDates.push(dateKst);
    for (const row of doc.rows) {
      const fid = String(row.providerMatchId);
      fixtureIds.set(fid, [...(fixtureIds.get(fid) ?? []), dateKst]);
      for (const side of [
        { name: row.homeTeamName, id: row.homeProviderTeamId },
        { name: row.awayTeamName, id: row.awayProviderTeamId },
      ]) {
        const name = String(side.name ?? "").trim();
        const id = String(side.id ?? "").trim();
        if (!name || !id) continue;
        const ids = nameToIds.get(name) ?? new Set();
        ids.add(id);
        nameToIds.set(name, ids);
        const names = idToNames.get(id) ?? new Set();
        names.add(name);
        idToNames.set(id, names);
        const ex = nameDateExamples.get(name) ?? [];
        ex.push({ dateKst, fixtureId: fid, providerTeamId: id });
        nameDateExamples.set(name, ex);
      }
    }
  }

  const stableExamples: Array<{
    canonicalNameFromFixture: string;
    providerTeamId: string;
    dates: string[];
  }> = [];
  const conflictingExamples: Array<{
    canonicalNameFromFixture: string;
    providerTeamIds: string[];
    dates: string[];
  }> = [];
  const singleAppearanceUnknown: string[] = [];

  for (const [name, ids] of nameToIds) {
    const dates = [
      ...new Set((nameDateExamples.get(name) ?? []).map((e) => e.dateKst)),
    ].sort();
    if (ids.size > 1) {
      conflictingExamples.push({
        canonicalNameFromFixture: name,
        providerTeamIds: [...ids].sort(),
        dates,
      });
    } else if (dates.length >= 2) {
      stableExamples.push({
        canonicalNameFromFixture: name,
        providerTeamId: [...ids][0],
        dates,
      });
    } else {
      singleAppearanceUnknown.push(name);
    }
  }

  const idNameConflicts = [...idToNames.entries()]
    .filter(([, names]) => names.size > 1)
    .map(([providerTeamId, names]) => ({
      providerTeamId,
      fixtureNames: [...names].sort(),
    }));

  const reusedFixtureIds = [...fixtureIds.entries()]
    .filter(([, dates]) => new Set(dates).size > 1 || dates.length > 1)
    .map(([fixtureId, dates]) => ({ fixtureId, dates: [...new Set(dates)] }))
    .filter((x) => x.dates.length > 1);

  return {
    scannedDates,
    missingDates,
    stableExampleCount: stableExamples.length,
    stableExamples: stableExamples.slice(0, 12),
    conflictingExamples,
    idMappedToMultipleFixtureNames: idNameConflicts,
    singleAppearanceNameCount: singleAppearanceUnknown.length,
    reusedFixtureIdsAcrossDates: reusedFixtureIds,
    note: "Stability is fixture-name → providerTeamId within existing schedule artifacts only. Not a live /teams probe. Same display name on one date is not a stability proof.",
  };
}

function traceChain(
  cwd: string,
  dateKst: string,
  matchId: string,
): Record<string, unknown> {
  const files = {
    schedule: `data/research/football/${dateKst}-schedule-v1.json`,
    odds: `data/research/football/${dateKst}-1x2-odds-v1.json`,
    snapshot: `data/research/football/${dateKst}-prediction-snapshot-v0.json`,
    prediction: `data/research/football/${dateKst}-market-baseline-prediction-v0.json`,
    result: `data/research/football/${dateKst}-official-result-v0.json`,
    review: `data/research/football/${dateKst}-market-baseline-review-v0.json`,
    scorecard: `data/research/football/${dateKst}-market-baseline-scorecard-v0.json`,
  };
  const present: Record<string, boolean> = {};
  const join: Record<string, unknown> = {};
  for (const [k, rel] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    present[k] = existsSync(abs);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, "utf8");
    join[k] = {
      path: rel,
      containsMatchId: raw.includes(matchId),
      containsFixtureDigits: raw.includes(matchId.replace("soccer-api-football-", "")),
    };
  }
  return { dateKst, matchId, present, join };
}

function optionScores() {
  const polarity =
    "Risk fields: 1=low risk (better), 5=high risk (worse). Capability fields: 1=poor, 5=strong.";
  return {
    scorePolarity: polarity,
    A_PRESEEDED_ONLY: {
      dataLossRisk: 4,
      falseMergeRisk: 2,
      providerConflictRisk: 2,
      leakageSafety: 5,
      operationalMaintainability: 1,
      big5OpeningReadiness: 1,
      oddsCompatibility: 3,
      resultTraceability: 2,
      rationale: {
        dataLossRisk:
          "Schedule keeps IDENTITY_BLOCKED rows, but Odds/Snapshot/Result/Grade skip or exclude them. Result is policy-lost.",
        falseMergeRisk:
          "Allowlist + K League denylist avoid guessing merges.",
        providerConflictRisk:
          "Known Jeonbuk/Ulsan IDs never MATCHED.",
        leakageSafety:
          "Pregame fixture IDs/team IDs are not postgame outcomes.",
        operationalMaintainability:
          "Every new club needs a catalog commit; 2026 /teams was rejected on Free Plan.",
        big5OpeningReadiness:
          "Opening Readiness v1 already scored identity as P0 catalog gap.",
        oddsCompatibility:
          "Catalog is necessary but not sufficient; Odds still needs The Odds API name bridge.",
        resultTraceability:
          "selectOfficialResultTargetRows filters ELIGIBLE_FORMAT only; identity-blocked fixtures are not fetched.",
      },
    },
    B_PROVIDER_ID_FIRST: {
      dataLossRisk: 1,
      falseMergeRisk: 3,
      providerConflictRisk: 3,
      leakageSafety: 5,
      operationalMaintainability: 4,
      big5OpeningReadiness: 4,
      oddsCompatibility: 2,
      resultTraceability: 5,
      rationale: {
        dataLossRisk:
          "Deterministic identity from fixture payload would keep Big-5/UCL rows research-visible.",
        falseMergeRisk:
          "Auto-canonical from providerTeamId does not merge 276 vs 2769 (different IDs). Risk is ID recycle / silent drift, not name merge.",
        providerConflictRisk:
          "Local Jeonbuk/Ulsan conflict is source disagreement, not proof live fixture IDs are wrong. Auto-MATCH still needs a denylist if humans later merge by name.",
        leakageSafety:
          "Same as A if only pregame fixture fields are used.",
        operationalMaintainability:
          "No paid /teams required to mint identity for observed fixtures.",
        big5OpeningReadiness:
          "Schedule/Result could proceed from /fixtures. Odds/Prediction still blocked without bridges.",
        oddsCompatibility:
          "Canonical ID ≠ Odds names. The Odds API join remains a separate gate.",
        resultTraceability:
          "Official Result already fetches by fixtureId; removing ELIGIBLE_FORMAT filter would collect scores.",
      },
    },
    C_HYBRID: {
      dataLossRisk: 1,
      falseMergeRisk: 2,
      providerConflictRisk: 2,
      leakageSafety: 5,
      operationalMaintainability: 4,
      big5OpeningReadiness: 4,
      oddsCompatibility: 4,
      resultTraceability: 5,
      rationale: {
        dataLossRisk:
          "Keep the official fixture row. Mark enrichment/odds/prediction separately instead of collapsing all into IDENTITY_BLOCKED.",
        falseMergeRisk:
          "Do not auto-merge conflicted IDs into one canonical name. Enrichment stays explicit.",
        providerConflictRisk:
          "Retain K League denylist for canonical MATCHED; still store provider fixture identity.",
        leakageSafety:
          "Provider identity from pregame fixture is not a result leak. Retroactive catalog apply to past predictions remains forbidden.",
        operationalMaintainability:
          "Catalog becomes enrichment, not the schedule existence gate.",
        big5OpeningReadiness:
          "Unblocks schedule/result completeness without claiming prediction readiness.",
        oddsCompatibility:
          "Honest split: Odds stay blocked without team-name bridge even if schedule PASSes provider identity.",
        resultTraceability:
          "Result-by-fixtureId can run while prediction stays BLOCKED/PENDING.",
      },
    },
  };
}

export function buildFootballProviderIdFirstIdentityAudit(cwd: string) {
  const frozenHashes = Object.fromEntries(
    Object.entries(FROZEN_REL).map(([k, rel]) => [
      k,
      { rel, sha256: sha256File(path.join(cwd, rel)) },
    ]),
  );

  const schedule20 = loadSchedule(cwd, "2026-08-20");
  if (!schedule20) {
    throw new Error("MISSING_2026_08_20_SCHEDULE");
  }

  const currentMatched = schedule20.rows.filter(
    (r) => r.identityStatus === "MATCHED",
  );
  const currentBlocked = schedule20.rows.filter(
    (r) => r.predictionEligibility === "IDENTITY_BLOCKED",
  );

  const hypothetical = {
    PROVIDER_IDENTIFIED: [] as ScheduleRow[],
    CANONICAL_ENRICHMENT_PENDING: [] as ScheduleRow[],
    INVALID_PROVIDER_IDENTITY: [] as ScheduleRow[],
  };
  const hypotheticalDetails = schedule20.rows.map((row) => {
    const c = classifyHypothetical(row);
    hypothetical[c.bucket].push(row);
    return {
      matchId: row.matchId,
      fixtureId: row.providerMatchId,
      home: row.homeTeamName,
      away: row.awayTeamName,
      currentIdentityStatus: row.identityStatus,
      currentEligibility: row.predictionEligibility,
      hypothetical: c.bucket,
      note: c.note,
    };
  });

  const atletico = schedule20.rows.find(
    (r) => r.providerMatchId === "1570334",
  );
  const celtic = schedule20.rows.find((r) => r.providerMatchId === "1610923");

  const callGraph = scanCallGraph(cwd);
  const stability = providerIdStability(cwd);
  const options = optionScores();

  const stageDependencyMatrix = [
    {
      stage: "Schedule",
      needsFixtureId: true,
      needsProviderTeamId: true,
      needsCanonicalTeamId: false,
      needsTeamName: false,
      needsOddsBridge: false,
      canOperateWithoutPreseedCatalog: true,
      currentPolicyRequiresPreseed: true,
      notes:
        "normalizeFixtureToScheduleRow already requires fixture.id + teams.home/away.id. Catalog only decides MATCHED vs IDENTITY_REVIEW_REQUIRED. Row is still stored.",
    },
    {
      stage: "Operator Join",
      needsFixtureId: false,
      needsProviderTeamId: false,
      needsCanonicalTeamId: false,
      needsTeamName: true,
      needsOddsBridge: false,
      canOperateWithoutPreseedCatalog: true,
      currentPolicyRequiresPreseed: false,
      notes:
        "2026-08-20 operator join matches screenshot Korean league/team labels to competition registry aliases. Catalog miss is not the football join key; missing operator aliases block MATCHED_REGISTERED.",
    },
    {
      stage: "Odds",
      needsFixtureId: false,
      needsProviderTeamId: false,
      needsCanonicalTeamId: true,
      needsTeamName: true,
      needsOddsBridge: true,
      canOperateWithoutPreseedCatalog: false,
      currentPolicyRequiresPreseed: true,
      notes:
        "planOddsFetches skips IDENTITY_BLOCKED. joinScheduleRowToOddsEvent needs canonical home/away IDs then The Odds API names via football-odds-team-bridge-v1. Catalog without bridge still fails.",
    },
    {
      stage: "Pregame Snapshot",
      needsFixtureId: true,
      needsProviderTeamId: false,
      needsCanonicalTeamId: true,
      needsTeamName: false,
      needsOddsBridge: true,
      canOperateWithoutPreseedCatalog: false,
      currentPolicyRequiresPreseed: true,
      notes:
        "Snapshot accounts IDENTITY_BLOCKED as blocked. Frozen usable odds require a prior odds join, which needs canonical IDs + bridge.",
    },
    {
      stage: "Market Baseline Prediction",
      needsFixtureId: true,
      needsProviderTeamId: false,
      needsCanonicalTeamId: false,
      needsTeamName: false,
      needsOddsBridge: true,
      canOperateWithoutPreseedCatalog: false,
      currentPolicyRequiresPreseed: true,
      notes:
        "Consumes snapshot only. IDENTITY_BLOCKED snapshot → SOURCE_IDENTITY_BLOCKED. No Engine. Missing catalog never produces a fake pick.",
    },
    {
      stage: "Official Result",
      needsFixtureId: true,
      needsProviderTeamId: true,
      needsCanonicalTeamId: false,
      needsTeamName: false,
      needsOddsBridge: false,
      canOperateWithoutPreseedCatalog: true,
      currentPolicyRequiresPreseed: true,
      notes:
        "Fetcher is getFixtureById(fixtureId). Join uses provider team IDs. Technically possible without catalog. Current policy: ELIGIBLE_FORMAT filter + identityFromScheduleRow throws if homeTeamId/awayTeamId missing.",
    },
    {
      stage: "Grade",
      needsFixtureId: false,
      needsProviderTeamId: false,
      needsCanonicalTeamId: false,
      needsTeamName: false,
      needsOddsBridge: false,
      canOperateWithoutPreseedCatalog: true,
      currentPolicyRequiresPreseed: true,
      notes:
        "Grade joins matchId from baseline prediction + official result. Needs a prediction artifact and a result artifact. Canonical team IDs are carried fields, not the grade key. No prediction ⇒ no PASS grade.",
    },
    {
      stage: "Review",
      needsFixtureId: false,
      needsProviderTeamId: false,
      needsCanonicalTeamId: false,
      needsTeamName: false,
      needsOddsBridge: false,
      canOperateWithoutPreseedCatalog: true,
      currentPolicyRequiresPreseed: true,
      notes:
        "Review is the canonical grade evidence wrapper over baseline + result. Same matchId join. Identity-blocked rows never enter this lane today because result/prediction were skipped.",
    },
    {
      stage: "Scorecard",
      needsFixtureId: false,
      needsProviderTeamId: false,
      needsCanonicalTeamId: false,
      needsTeamName: false,
      needsOddsBridge: false,
      canOperateWithoutPreseedCatalog: true,
      currentPolicyRequiresPreseed: true,
      notes:
        "Scorecard aggregates review grades. No independent identity gate.",
    },
  ];

  const document = {
    schemaVersion: SCHEMA,
    generatedAt: new Date().toISOString(),
    researchOnly: true,
    networkCalls: 0,
    predictionCalls: 0,
    resultCalls: 0,
    network: {
      apiFootball: 0,
      theOddsApi: 0,
      providerCalls: 0,
    },
    frozenArtifactMutations: 0,
    mandatoryCompletion: {
      dateKst: "2026-08-20",
      total: "60%",
      unchanged: true,
      thisMission: "OPTIONAL_DEVELOPMENT_AUDIT",
    },
    currentIdentitySoT: callGraph,
    duplicateIdentitySystems: [
      {
        component: "src/lib/football/core/team-catalog.ts",
        role: "Operational team allowlist / conflict denylist for football-schedule-v1",
        consumedBy: [
          "src/lib/football/core/identity.ts",
          "src/lib/football/core/normalize.ts (via identity)",
          "src/lib/football/core/build-schedule.ts",
        ],
        identityKey: "provider + providerTeamId → fb-team-v1-api-football-{providerTeamId}",
        blockingAuthority:
          "YES — unknown or blocked providerTeamId ⇒ identityStatus IDENTITY_REVIEW_REQUIRED ⇒ predictionEligibility IDENTITY_BLOCKED",
        currentOrLegacy: "CURRENT",
        soT: true,
      },
      {
        component: "src/lib/football/foundation/team-registry.ts",
        role: "Foundation v0 seed registry for identity-gate tests / operation-memory snapshot",
        consumedBy: [
          "src/lib/football/foundation/identity-gate.ts",
          "src/lib/football/foundation/operation-memory-slice.ts",
          "src/lib/football/foundation/index.ts",
          "scripts/test-football-identity-foundation-v0.ts",
        ],
        identityKey: "provider + providerTeamId (no fb-team-v1 prefix)",
        blockingAuthority:
          "NO for current research Schedule. YES only inside evaluateFootballIdentityGate, which Schedule does not call.",
        currentOrLegacy: "LEGACY / TEST-ONLY relative to operational Schedule",
        soT: false,
      },
      {
        component: "src/lib/football/foundation/identity-gate.ts",
        role: "Foundation v0 predictionAllowed gate (fixture + registered teams + competition)",
        consumedBy: [
          "src/lib/football/foundation/index.ts (developer snapshot string only)",
          "scripts/test-football-identity-foundation-v0.ts",
        ],
        identityKey: "fixtureId + homeTeamId/awayTeamId as registry provider IDs",
        blockingAuthority: "NO for current football-schedule-v1",
        currentOrLegacy: "LEGACY / TEST-ONLY",
        soT: false,
      },
      {
        component: "src/lib/football/foundation/match-identity.ts",
        role: "matchId constructor soccer-{provider}-{fixtureId}",
        consumedBy: [
          "src/lib/football/core/normalize.ts",
          "src/lib/football/official-result-v0/build.ts",
        ],
        identityKey: "provider + fixtureId",
        blockingAuthority: "ID construction only; not a catalog gate",
        currentOrLegacy: "CURRENT (shared helper)",
        soT: true,
      },
    ],
    layers: {
      providerFixture: {
        fields: [
          "provider=api-football",
          "fixtureId / providerMatchId",
          "league.id → competition profile",
          "league.season → seasonId",
          "fixture.date → kickoffTimeUtc",
        ],
        uniqueForApiFootballFixture: true,
        blockingAuthority:
          "YES for Schedule ingest (missing fixture.id throws). Unregistered competition DROPS the row (UNREGISTERED_COMPETITION), which is a competition-profile gate not a team-catalog gate.",
        matchIdCollision: {
          form: "soccer-api-football-{fixtureId}",
          usesTeamPair: false,
          usesKickoffOnly: false,
          includesFixtureId: true,
          includesCompetition: false,
          includesProviderNamespace: true,
          verdict: "SAFE",
          note: "Same clubs in league/cup/continental get different fixtureIds. Reschedule typically keeps the same API-Football fixture id. Artifact scan found no fixtureId reused across the audited schedule dates.",
        },
      },
      providerParticipants: {
        fields: ["teams.home.id", "teams.away.id"],
        sufficientInsideProviderNamespace: true,
        blockingAuthority:
          "YES for ingest (PROVIDER_TEAM_ID_MISSING throws). Catalog miss does not strip these fields from the stored row.",
        trustBoundary:
          "These IDs are provider-supplied in the same fixture payload as fixture.id. They are not locally guessed.",
      },
      canonicalTeam: {
        fields: [
          "canonicalTeamId",
          "canonicalName",
          "aliases",
          "country",
          "cross-provider mapping",
        ],
        requiredForFixtureIdentity: false,
        role: "ENRICHMENT + VERIFICATION ALLOWLIST + CONFLICT DENYLIST",
        blockingAuthorityToday:
          "YES for predictionEligibility IDENTITY_BLOCKED, even when Layer A+B are complete.",
        designIntentFromCode:
          "team-catalog.ts: canonicalTeamId is PROVIDER_SEEDED_V1. Do not auto-create name slugs. K League conflicts: do NOT guess. Catalog entry is therefore a verification/allowlist gate, not a second ID namespace.",
      },
      operatorDisplay: {
        fields: [
          "한국어 팀명",
          "short labels",
          "operator aliases",
          "competition aliases",
        ],
        shouldBlockScheduleProviderIdentity: false,
        role: "SUPPLEMENTAL MAPPING",
        blockingAuthorityToday:
          "Blocks operator MATCHED_REGISTERED (screenshot labels), not Schedule provider identity. 2026-08-20 football operator joins were IDENTITY_BLOCKED / UNREGISTERED_COMPETITION on labels, independent of fixture IDs already on the schedule artifact.",
      },
    },
    officialFixtureTrustBoundary: {
      scheduleInputFieldsFromProvider: [
        "fixture.id",
        "league.id",
        "league.season",
        "teams.home.id",
        "teams.away.id",
        "fixture.date",
        "teams.home.name / teams.away.name (display only)",
        "fixture.venue.name (display only)",
      ],
      localEnrichment: [
        "competitionId from local competition profile",
        "matchFormat from profile.defaultMatchFormat",
        "homeTeamId/awayTeamId from team catalog",
        "identityStatus / identityReasons / predictionEligibility",
      ],
      providerIdsAreGuessed: false,
      note: "Do not confuse live fixture teams.*.id with locally recorded conflicting IDs in foundation registry vs team-aliases.ts.",
    },
    canonicalIdStrategy: {
      form: "fb-team-v1-api-football-{providerTeamId}",
      alreadyProviderSeeded: true,
      whyCatalogStillRequiredToday: [
        "Verification / allowlist: unknown IDs are IDENTITY_REVIEW_REQUIRED rather than auto-MATCHED.",
        "Conflict protection: Jeonbuk 276 vs 2769 and Ulsan 275 vs 2764 are blocked from MATCHED.",
        "Not because a different independent canonical namespace exists in v1.",
        "Comment also defers provider-independent IDs to a later migration.",
      ],
      source: "src/lib/football/core/team-catalog.ts header + matched()",
    },
    kLeagueConflict: {
      jeonbuk: {
        canonicalName: "Jeonbuk Motors",
        conflictingProviderTeamIds: ["276", "2769"],
        sources: [
          "src/lib/football/foundation/team-registry.ts → 276",
          "src/lib/teams/team-aliases.ts → 2769",
        ],
      },
      ulsan: {
        canonicalName: "Ulsan HD",
        conflictingProviderTeamIds: ["275", "2764"],
        sources: [
          "src/lib/football/foundation/team-registry.ts → 275",
          "src/lib/teams/team-aliases.ts → 2764",
        ],
      },
      classification: "B",
      classificationLabel:
        "Local/source disagreement: two past local sources recorded different provider IDs for the same canonical name.",
      notA: "Does not prove API-Football fixture teams.*.id is untrustworthy.",
      notProvenC: "Provider ID change / stale source is possible but not demonstrated by a live fixture in this audit (network=0).",
      doesItInvalidateFixtureProviderIdentity: "NO",
      catalogBlockedIdCount: FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.size,
      foundationRegistrySize: FOOTBALL_TEAM_REGISTRY_V0.length,
      coreCatalogSize: FOOTBALL_TEAM_CATALOG_V1.length,
      conflictsDeclared: FOOTBALL_TEAM_CONFLICTS_V1.length,
    },
    caseStudy20260820: {
      scheduleGames: schedule20.meta.scheduleGames ?? schedule20.rows.length,
      currentMatched: currentMatched.length,
      currentIdentityBlocked: currentBlocked.length,
      atleticoMalaga: atletico
        ? {
            matchId: atletico.matchId,
            fixtureId: atletico.providerMatchId,
            competitionId: atletico.competitionId,
            seasonId: atletico.seasonId,
            kickoffTimeUtc: atletico.kickoffTimeUtc,
            homeProviderTeamId: atletico.homeProviderTeamId,
            awayProviderTeamId: atletico.awayProviderTeamId,
            homeTeamName: atletico.homeTeamName,
            awayTeamName: atletico.awayTeamName,
            homeTeamId: atletico.homeTeamId,
            awayTeamId: atletico.awayTeamId,
            identityStatus: atletico.identityStatus,
            identityReasons: atletico.identityReasons,
            predictionEligibility: atletico.predictionEligibility,
            providerIdentityComplete: providerIdentityComplete(atletico),
            currentBlockReason: "UNKNOWN_PROVIDER_TEAM_ID for 530 and 535 (catalog miss), not missing fixture identity",
          }
        : null,
      celticLask: celtic
        ? {
            matchId: celtic.matchId,
            fixtureId: celtic.providerMatchId,
            competitionId: celtic.competitionId,
            homeProviderTeamId: celtic.homeProviderTeamId,
            awayProviderTeamId: celtic.awayProviderTeamId,
            homeTeamName: celtic.homeTeamName,
            awayTeamName: celtic.awayTeamName,
            providerIdentityComplete: providerIdentityComplete(celtic),
            currentBlockReason: "UNKNOWN_PROVIDER_TEAM_ID for 247 and 1026",
          }
        : null,
      providerIdentityCompletenessOnBlockedRows: currentBlocked.every(
        providerIdentityComplete,
      ),
    },
    memoryOnlyCounterfactual: {
      artifactModified: false,
      current: {
        matched: currentMatched.length,
        blocked: currentBlocked.length,
      },
      providerIdFirstHypothetical: {
        providerIdentified: hypothetical.PROVIDER_IDENTIFIED.length,
        canonicalPending: hypothetical.CANONICAL_ENRICHMENT_PENDING.length,
        invalidProviderIdentity: hypothetical.INVALID_PROVIDER_IDENTITY.length,
      },
      rows: hypotheticalDetails,
      interpretation:
        "PROVIDER_IDENTIFIED = Layer A+B complete and both teams already in catalog. CANONICAL_ENRICHMENT_PENDING = Layer A+B complete without catalog MATCHED. INVALID_PROVIDER_IDENTITY = missing provider fixture/participant fields. These names are audit-only; no code enum added.",
    },
    stageDependencyMatrix,
    scheduleQuestion: {
      purposeIfTodayOfficialFixtures: true,
      blockingWholeRowBecauseCatalogMissing: {
        storedOnArtifact: false,
        markedIdentityBlocked: true,
        contractCommentFoundationV0RequiresGate: true,
        operationalBuilderDropsRow: false,
        verdict:
          "Not valid if the purpose is to record that an official fixture exists. The operational builder already stores the row. Collapsing catalog miss into IDENTITY_BLOCKED then excluding the same row from Result is the actual data-loss policy. Foundation v0 contract comments overstate a drop that does not happen in core/build-schedule.ts.",
      },
    },
    oddsSeparation: {
      scheduleIdentityIsNotOddsIdentity: true,
      whyOddsBlockedWithoutCatalog: [
        "Odds fetch planner skips predictionEligibility !== ELIGIBLE_FORMAT, so IDENTITY_BLOCKED never reaches The Odds API query set.",
        "Even MATCHED rows need canonicalTeamId to look up football-odds-team-bridge-v1 names.",
        "Join is sport-key + exact odds team names + kickoff tolerance, not API-Football fixtureId.",
      ],
      savingScheduleDoesNotMakeOddsReady: true,
    },
    resultAudit: {
      fetchesByFixtureId: true,
      technicallyPossibleWithoutCanonicalCatalog: true,
      currentlyExcludedByPolicy: true,
      distinction:
        "TECHNICALLY_POSSIBLE vs CURRENT_POLICY_BLOCKS. identityFromScheduleRow additionally throws if canonical homeTeamId/awayTeamId missing, which is a second policy coupling — not a provider limitation.",
    },
    gradeAudit: {
      joinKeys: ["matchId", "predictionHash / baseline artifact", "resultHash"],
      needsCanonicalTeamIdsAsGradeKey: false,
      needsPrediction: true,
      needsOfficialResult: true,
      providerIdFirstRowWithoutPrediction: "BLOCKED / not a PASS grade",
      noForcedGrade: true,
    },
    historicalProviderIdStability: stability,
    endToEndFixtureTraces: [
      {
        label: "La Liga 2026-08-18 Deportivo–Elche",
        ...traceChain(cwd, "2026-08-18", "soccer-api-football-1570337"),
        joinKeys: {
          schedule: "matchId=soccer-api-football-1570337 providerMatchId=1570337 homeProviderTeamId=544 awayProviderTeamId=797 canonical fb-team-v1-api-football-544/797",
          odds: "matchId + apiFootballProviderMatchId=1570337 + oddsProviderEventId=7b9f4d89d66c48e0c496aab1679e4ae4 + sportKey=soccer_spain_la_liga + canonical team IDs + odds names",
          snapshot: "matchId + frozenScheduleRow.providerMatchId + frozenOddsObservation.observationId",
          prediction: "matchId + sourceSnapshotHash",
          result: "matchId + fixtureId=1570337 + resultHash",
          review: "matchId + sourceMarketBaselinePredictionHash + sourceOfficialResultArtifactHash + sourceMatchResultHash",
          scorecard: "same matchId / hashes as review",
        },
      },
      {
        label: "J1 2026-08-14 Tokyo Verdy–Kashiwa Reysol",
        ...traceChain(cwd, "2026-08-14", "soccer-api-football-1556021"),
        joinKeys: {
          schedule: "matchId=soccer-api-football-1556021 providerMatchId=1556021",
          odds: "matchId + apiFootballProviderMatchId=1556021 + oddsProviderEventId=b5533f61730b76f4a8f39ed5918218ae",
          snapshot: "matchId",
          prediction: "matchId",
          result: "matchId + fixtureId=1556021",
          review: "artifact absent",
          scorecard: "artifact absent",
        },
      },
    ],
    leakage: {
      providerFixtureIdPregameUse: "SAFE",
      postgameRetroactiveEnrichment: "FORBIDDEN",
      explanation:
        "Using fixtureId / providerTeamIds / competition / kickoff that already existed on the pregame fixture payload does not import postgame scores or odds. Applying a later catalog mapping backward onto a sealed prediction would be leakage/identity rewrite and remains forbidden.",
    },
    dataLoss: {
      currentScheduleOfficialRowsDisappear: "NO",
      currentResultOfficialRowsDisappear: "YES",
      currentResultDisappearKind: "CURRENT_POLICY_BLOCKS",
      hybridScheduleOfficialRowsDisappear: "NO",
      hybridResultOfficialRowsDisappear: "NO",
      yangEdgePreference:
        "Prefer explicit BLOCKED/PENDING storage over silent omission. Current Schedule already stores blocked rows; Result does not.",
    },
    options: {
      A_PRESEEDED_ONLY: {
        name: "PRESEEDED_ONLY",
        summary:
          "Keep requiring local Team Catalog MATCHED before Schedule identity PASS / ELIGIBLE_FORMAT.",
        advantages: [
          "Human-verified allowlist before MATCHED.",
          "K League conflicts cannot silently MATCH.",
        ],
        risks: [
          "Paid /teams or manual slate required for every new club.",
          "Result collection skipped for catalog-miss rows.",
          "Big-5 opening remains identity-blocked on incomplete catalog.",
        ],
        operationalCost: "HIGH",
        openingReadiness2026_27: "P0 catalog blocker remains",
        scores: options.A_PRESEEDED_ONLY,
      },
      B_PROVIDER_ID_FIRST: {
        name: "PROVIDER_ID_FIRST",
        summary:
          "Mint canonicalTeamId from provider+providerTeamId on sight. Catalog is optional enrichment.",
        advantages: [
          "No 2026 /teams needed to identify fixtures.",
          "Does not false-merge distinct provider IDs.",
        ],
        risks: [
          "Silent provider ID recycle would mint a stable-looking canonical ID.",
          "Odds still blocked; operators might treat PROVIDER_IDENTIFIED as prediction-ready.",
          "Name-level clubs with two IDs become two identities until a later merge mission.",
        ],
        kLeagueHandling:
          "Keep 276/2769 and 275/2764 as distinct provider identities; do not auto-merge to one Jeonbuk/Ulsan canonical name.",
        oddsImpact: "UNCHANGED_STILL_NEEDS_NAME_BRIDGE",
        scores: options.B_PROVIDER_ID_FIRST,
      },
      C_HYBRID: {
        name: "HYBRID",
        summary:
          "Schedule/Result accept provider fixture identity. Prediction/Odds/Operator remain gated on enrichment/bridge/aliases.",
        advantages: [
          "Official matches are not lost.",
          "Prediction cannot sneak through on an unenriched team.",
          "Matches YANG EDGE explicit-status preference.",
          "Paid /teams not required for identity of fixtures already returned by /fixtures.",
        ],
        risks: [
          "New status semantics can be misread as READY.",
          "Result without prediction creates unmatched postgame rows — must stay BLOCKED in Grade, not silent PASS.",
          "Still need drift detection on providerTeamId.",
        ],
        proposedFutureSemanticsOnly: [
          "PROVIDER_IDENTIFIED",
          "CANONICAL_PENDING",
          "ODDS_BRIDGE_BLOCKED",
          "OPERATOR_ALIAS_BLOCKED",
        ],
        enumAddedThisMission: false,
        scores: options.C_HYBRID,
      },
    },
    decision: {
      recommendation: "HYBRID",
      recommendationCode: "HYBRID",
      rejected: ["PRESEEDED_ONLY", "PROVIDER_ID_FIRST", "INSUFFICIENT_EVIDENCE"],
      why:
        "2026-08-20 Atletico/Malaga and Celtic/Lask already had complete provider fixture identity and were still IDENTITY_BLOCKED solely for catalog miss. Canonical IDs are already provider-seeded. Odds/Prediction must stay separately gated. Full auto-MATCH (Option B) over-claims enrichment and weakens the K League denylist's operational meaning. Evidence is sufficient; retaining the current collapse of catalog-miss into fixture-unidentified is the design error being audited.",
      openingReadinessProjectionOnly: {
        historicalScoresNotRewritten: {
          EPL: 65,
          LA_LIGA: 82,
          SERIE_A: 61,
          BUNDESLIGA: 62,
          LIGUE_1: 61,
        },
        possibleGateScoreImprovementIfAdopted: {
          schedule: "POSSIBLE — Big-5 fixtures can remain research-complete without 2026 /teams",
          identity: "POSSIBLE for fixture-layer identity; catalog-completeness scoring in opening-readiness-v1 would still flag enrichment gaps unless that gate is respecified",
          odds: "UNLIKELY without team-name bridge work",
          freeze: "UNLIKELY (depends on odds)",
          prediction: "UNLIKELY (depends on freeze/odds)",
          result: "POSSIBLE if selector uses fixtureId instead of ELIGIBLE_FORMAT",
          gradeReview: "NO auto improvement — still needs prediction+result pair",
        },
      },
    },
    paidApiImpact: {
      scheduleResultWithout2026TeamsEndpoint: "YES",
      oddsPredictionWithout2026TeamsEndpoint: "PARTIAL",
      oddsPredictionDetail:
        "Odds/Prediction do not fail because /teams is missing. They fail because of catalog allowlist coupling plus The Odds API name bridge. 2026 /teams would help enrichment aliases but is not the Odds join key.",
      paidPlanClassification: "NOT_NEEDED_FOR_IDENTITY",
      paidPlanNuance: "P1_USEFUL for roster/name completeness and human verification; not P0 for identifying fixtures already present in /fixtures.",
      removesNeedForPaidApi: "PARTIALLY",
    },
    failureSemanticsProposal: {
      codeChangeThisMission: false,
      enumAddedThisMission: false,
      ifHybridAdoptedLater: [
        "PROVIDER_IDENTIFIED — Layer A+B complete",
        "CANONICAL_PENDING — catalog MATCHED missing or denylisted",
        "ODDS_BRIDGE_BLOCKED — no The Odds API name mapping",
        "OPERATOR_ALIAS_BLOCKED — screenshot label miss",
        "IDENTITY_BLOCKED reserved for actually invalid/missing provider identity",
      ],
    },
    risks: {
      devilAdvocateAgainstHybrid: {
        whatCanGoWrong: [
          "Operators treat stored fixture rows as prediction-eligible.",
          "Result rows accumulate without predictions and get force-graded.",
          "Provider recycles a team ID; hybrid would keep a stable canonical that now points at a different club.",
          "Competition-unregistered drops (290 on 2026-08-20) remain a separate data-loss path this audit does not fix.",
        ],
        invalidatingEvidence: [
          "A live API-Football fixture whose teams.home.id / teams.away.id do not identify the clubs that actually played.",
          "Documented fixtureId reuse across unrelated matches.",
          "Proof that 276 and 2769 are the same current API-Football team ID rather than two local records.",
        ],
        newLeakageOrIdentityRisk:
          "None from using pregame fixture IDs. Risk is semantic: PENDING stored next to READY. Retroactive enrichment of sealed predictions remains forbidden.",
        silentProviderIdDriftDetection: [
          "Alert when the same canonicalName maps to a new providerTeamId vs prior schedule artifacts.",
          "Alert when the same providerTeamId maps to a new fixture name.",
          "Keep K League denylist until a human merge decision.",
          "Compare fixture team IDs at result-join time against the sealed schedule row (already implemented in join-schedule.ts).",
        ],
        falseMergeRisk:
          "Hybrid+provider IDs false-merge less than name-merge. The remaining false-merge path is treating two historical local IDs as one club without evidence.",
      },
    },
    minimalNextMission: {
      title: "Football Schedule Hybrid Identity Gate v1",
      autoExecute: false,
      filesLikely: [
        "src/lib/football/core/identity.ts",
        "src/lib/football/core/types.ts",
        "src/lib/football/official-result-v0/build.ts",
        "scripts/test-football-schedule-v1.ts",
        "scripts/test-football-official-result-v0.ts",
      ],
      notInScope: [
        "team catalog expansion",
        "odds team bridge",
        "operator aliases",
        "Engine / Prediction formula",
        "paid /teams fetch",
      ],
      behavior:
        "Split provider fixture identity from canonical enrichment. Keep predictionEligibility blocked without catalog/bridge. Allow Official Result selection by providerMatchId even when canonical IDs are null. Do not add a giant identity framework.",
    },
    frozenHashes,
    catalogCounts: {
      coreCatalog: FOOTBALL_TEAM_CATALOG_V1.length,
      foundationRegistry: FOOTBALL_TEAM_REGISTRY_V0.length,
      blockedProviderTeamIds: [...FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS].sort(),
    },
    sourceInventoryNote:
      "Call-graph booleans are file-string evidence. Counts and traces are computed from existing artifacts. No network.",
  };

  const stagesPresent = new Set(
    document.stageDependencyMatrix.map((s) => s.stage),
  );
  for (const s of STAGES) {
    if (!stagesPresent.has(s)) {
      throw new Error(`STAGE_MATRIX_INCOMPLETE: ${s}`);
    }
  }

  return { document, frozenHashes };
}

export async function writeFootballProviderIdFirstIdentityAudit(
  cwd: string,
): Promise<{
  document: ReturnType<typeof buildFootballProviderIdFirstIdentityAudit>["document"];
}> {
  const { document } = buildFootballProviderIdFirstIdentityAudit(cwd);
  const abs = path.join(cwd, AUDIT_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return { document };
}

async function main() {
  const cwd = process.cwd();
  const { document } = await writeFootballProviderIdFirstIdentityAudit(cwd);
  const extra = readdirSync(path.join(cwd, "data/audits")).filter((n) =>
    n.includes("provider-id-first"),
  );
  console.log(
    [
      `wrote ${AUDIT_REL}`,
      `recommendation=${document.decision.recommendation}`,
      `currentMatched=${document.memoryOnlyCounterfactual.current.matched}`,
      `currentBlocked=${document.memoryOnlyCounterfactual.current.blocked}`,
      `hypotheticalIdentified=${document.memoryOnlyCounterfactual.providerIdFirstHypothetical.providerIdentified}`,
      `hypotheticalPending=${document.memoryOnlyCounterfactual.providerIdFirstHypothetical.canonicalPending}`,
      `hypotheticalInvalid=${document.memoryOnlyCounterfactual.providerIdFirstHypothetical.invalidProviderIdentity}`,
      `networkCalls=${document.networkCalls}`,
      `auditFiles=${extra.join(",")}`,
    ].join("\n"),
  );
}

const isDirect = process.argv[1]?.replaceAll("\\", "/").endsWith(
  "audit-football-provider-id-first-identity-v1.ts",
);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
