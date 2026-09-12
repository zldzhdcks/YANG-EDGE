/** Local sealed-evidence research viewer. Read only. No prediction, refit, or provider. Market comparison is post-freeze only. */
import {existsSync} from "node:fs";
import {join} from "node:path";
import {storeRoot,readSeal,digest} from "../football-v31-r1-prospective-v1/store-v1";
import {
  FIRST_BATCH_AUDIT,
  FIRST_BATCH_AUDIT_SHA,
  artifactPath,
  loadSealedTargets,
  readEnvelope,
  type ExpectedSeal,
  type PostgamePayload,
  type ModelGrade,
} from "../football-v31-r1-prospective-postgame-v1/grader-v1";
import {leagueLabel,teamLabel} from "./labels-v1";
import {
  HANDICAP_COMPARISON_ENABLED,
  MARKET_DISCLAIMER,
  MARKET_INPUT_TO_MODEL,
  MARKET_TYPE,
  ROUND_IDENTITY_CONFIRMED,
  TOTALS_RECOMMENDATION_ENABLED,
  type MarketComparisonView,
  type MarketSummary,
} from "../football-v31-internal-market-comparison-v1/contract-v1";
import {loadOwnerOnlyMarkets,resolveMarketEvidenceFile} from "../football-v31-internal-market-comparison-v1/local-evidence-v1";
import {compareSealedToMarket,summarizeMarket} from "../football-v31-internal-market-comparison-v1/compare-v1";

export const SCHEMA = "FOOTBALL_V31_INTERNAL_RESEARCH_CONSOLE_V1";
export const ROUTE = "/internal/football/research";
export const DISCLAIMER =
  "Prospective research evidence — not a validated recommendation model";
export const MODEL_PROMOTED = "NO" as const;
export const R1_ROLE = "UNPROMOTED_PROSPECTIVE_SHADOW" as const;
export const SOURCE_MODE = "LOCAL_ONLY" as const;
export const CHECKPOINT_N = 25;
export const RELATIVE_DEFAULT_ROOT = join(
  "..",
  "YANG-EDGE-INBOX",
  "football-v31-r1-prospective-shadow-v1",
);

export type ResearchGate =
  | "OK"
  | "INTERNAL_RESEARCH_DISABLED"
  | "LOCAL_RESEARCH_DATA_UNAVAILABLE"
  | "INTEGRITY_BLOCKED";
export type Consensus =
  | "TRIPLE_CONSENSUS"
  | "H2_R1_CONSENSUS"
  | "SPLIT"
  | "PASS"
  | "INTEGRITY_BLOCKED";
export type EvidenceStatus =
  | "SEALED"
  | "PENDING_RESULT"
  | "GRADED"
  | "BLOCKED"
  | "PASS"
  | "INTEGRITY_BLOCKED";
export type ModelView = {
  status: "PREDICTED" | "PASS" | "INTEGRITY_BLOCKED";
  homePct: number | null;
  drawPct: number | null;
  awayPct: number | null;
  predictedClass: string | null;
};
export type GradeView = {
  status: "GRADED" | "PREGAME_PASS_PRESERVED";
  correct: boolean | null;
  logLoss: number | null;
  brier: number | null;
};
export type PostgameView =
  | {
      status: "GRADED";
      actualResult: string;
      actualClass: string;
      v1: GradeView;
      h2: GradeView;
      r1: GradeView;
    }
  | {status: "RESULT_PENDING"}
  | {status: "INTEGRITY_BLOCKED"};
export type FixtureView = {
  fixtureId: number;
  kickoffUtc: string;
  kickoffKst: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  v1: ModelView;
  h2: ModelView;
  r1: ModelView;
  consensus: Consensus;
  evidence: EvidenceStatus;
  integrity: "verified" | "INTEGRITY_BLOCKED";
  snapshotShortHash: string | null;
  postgame: PostgameView;
  marketComparison: MarketComparisonView;
};
export type ResearchSummary = {
  sealedTargets: number;
  r1Predicted: number;
  r1Pass: number;
  resultPending: number;
  resultGraded: number;
  resultBlocked: number;
  r1GradedPredicted: number;
  checkpoint: {label: string; current: number; next: number};
};
export type ResearchConsoleView = {
  schema: typeof SCHEMA;
  gate: ResearchGate;
  sourceMode: typeof SOURCE_MODE;
  route: typeof ROUTE;
  disclaimer: typeof DISCLAIMER;
  modelPromoted: typeof MODEL_PROMOTED;
  r1Role: typeof R1_ROLE;
  summary: ResearchSummary;
  pending: FixtureView[];
  graded: FixtureView[];
  blocked: FixtureView[];
  marketType: typeof MARKET_TYPE;
  roundIdentityConfirmed: typeof ROUND_IDENTITY_CONFIRMED;
  marketInputToModel: typeof MARKET_INPUT_TO_MODEL;
  totalsRecommendationEnabled: typeof TOTALS_RECOMMENDATION_ENABLED;
  handicapComparisonEnabled: typeof HANDICAP_COMPARISON_ENABLED;
  marketDisclaimer: typeof MARKET_DISCLAIMER;
  marketSummary: MarketSummary;
};

type PredictionRow = {
  payload: {
    status: string;
    passReason: string[];
    probabilities: [number, number, number] | null;
    class: string | null;
  };
  sha256: string;
};

const BLOCKED_MODEL: ModelView = {
  status: "INTEGRITY_BLOCKED",
  homePct: null,
  drawPct: null,
  awayPct: null,
  predictedClass: null,
};

export function researchAccess(env: NodeJS.ProcessEnv = process.env): ResearchGate {
  if (env.NODE_ENV === "production") return "INTERNAL_RESEARCH_DISABLED";
  return "OK";
}

export function resolveLocalResearchRoot(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const override = env.FOOTBALL_V31_INTERNAL_RESEARCH_ROOT?.trim();
  if (override) return override;
  return join(cwd, RELATIVE_DEFAULT_ROOT);
}

export function localRootAvailable(root: string): boolean {
  try {
    return existsSync(root) && existsSync(storeRoot(root));
  } catch {
    return false;
  }
}

export function formatKickoffKst(kickoffUtc: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(kickoffUtc));
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")} KST`;
}

export function classifyConsensus(
  v1: ModelView,
  h2: ModelView,
  r1: ModelView,
): Consensus {
  if (
    v1.status === "INTEGRITY_BLOCKED" ||
    h2.status === "INTEGRITY_BLOCKED" ||
    r1.status === "INTEGRITY_BLOCKED"
  ) {
    return "INTEGRITY_BLOCKED";
  }
  if (
    v1.status === "PREDICTED" &&
    h2.status === "PREDICTED" &&
    r1.status === "PREDICTED" &&
    v1.predictedClass &&
    v1.predictedClass === h2.predictedClass &&
    h2.predictedClass === r1.predictedClass
  ) {
    return "TRIPLE_CONSENSUS";
  }
  if (
    h2.status === "PREDICTED" &&
    r1.status === "PREDICTED" &&
    h2.predictedClass &&
    h2.predictedClass === r1.predictedClass
  ) {
    return "H2_R1_CONSENSUS";
  }
  if (v1.status === "PASS" || h2.status === "PASS" || r1.status === "PASS") {
    return "PASS";
  }
  return "SPLIT";
}

export function projectModel(row: PredictionRow): ModelView {
  if (row.payload.status === "PASS") {
    return {
      status: "PASS",
      homePct: null,
      drawPct: null,
      awayPct: null,
      predictedClass: null,
    };
  }
  const p = row.payload.probabilities;
  if (row.payload.status !== "PREDICTED" || !p || !row.payload.class) {
    return BLOCKED_MODEL;
  }
  return {
    status: "PREDICTED",
    homePct: p[0],
    drawPct: p[1],
    awayPct: p[2],
    predictedClass: row.payload.class,
  };
}

function projectGrade(grade: ModelGrade): GradeView {
  return {
    status: grade.status,
    correct: grade.correct,
    logLoss: grade.logLoss,
    brier: grade.multiclassBrier,
  };
}

function emptySummary(): ResearchSummary {
  return {
    sealedTargets: 0,
    r1Predicted: 0,
    r1Pass: 0,
    resultPending: 0,
    resultGraded: 0,
    resultBlocked: 0,
    r1GradedPredicted: 0,
    checkpoint: {
      label: "R1 graded PREDICTED / 25",
      current: 0,
      next: CHECKPOINT_N,
    },
  };
}

function gatedView(gate: Exclude<ResearchGate, "OK">): ResearchConsoleView {
  return {
    schema: SCHEMA,
    gate,
    sourceMode: SOURCE_MODE,
    route: ROUTE,
    disclaimer: DISCLAIMER,
    modelPromoted: MODEL_PROMOTED,
    r1Role: R1_ROLE,
    summary: emptySummary(),
    pending: [],
    graded: [],
    blocked: [],
    marketType: MARKET_TYPE,
    roundIdentityConfirmed: ROUND_IDENTITY_CONFIRMED,
    marketInputToModel: MARKET_INPUT_TO_MODEL,
    totalsRecommendationEnabled: TOTALS_RECOMMENDATION_ENABLED,
    handicapComparisonEnabled: HANDICAP_COMPARISON_ENABLED,
    marketDisclaimer: MARKET_DISCLAIMER,
    marketSummary: {matched: 0, unmatched: 0, identityBlocked: 0},
  };
}

function identityView(expected: ExpectedSeal, extra: Partial<FixtureView>): FixtureView {
  return {
    fixtureId: expected.fixtureId,
    kickoffUtc: expected.kickoffUtc,
    kickoffKst: formatKickoffKst(expected.kickoffUtc),
    league: leagueLabel(expected.leagueId),
    homeTeam: teamLabel(expected.homeTeamId),
    awayTeam: teamLabel(expected.awayTeamId),
    v1: BLOCKED_MODEL,
    h2: BLOCKED_MODEL,
    r1: BLOCKED_MODEL,
    consensus: "INTEGRITY_BLOCKED",
    evidence: "INTEGRITY_BLOCKED",
    integrity: "INTEGRITY_BLOCKED",
    snapshotShortHash: null,
    postgame: {status: "INTEGRITY_BLOCKED"},
    marketComparison: compareSealedToMarket(expected, {v1: BLOCKED_MODEL, h2: BLOCKED_MODEL, r1: BLOCKED_MODEL}, []),
    ...extra,
  };
}

function readPostgame(
  root: string,
  expected: ExpectedSeal,
): {ok: true; payload: PostgamePayload} | {ok: false; missing: boolean} {
  const file = artifactPath(root, expected.fixtureId);
  if (!existsSync(file)) return {ok: false, missing: true};
  try {
    const seal = readSeal<PostgamePayload>(file);
    if (
      seal.payload.pregameSnapshotHash !== expected.snapshotHash ||
      seal.payload.v1PredictionHash !== expected.v1PredictionHash ||
      seal.payload.h2PredictionHash !== expected.h2PredictionHash ||
      seal.payload.r1PredictionHash !== expected.r1PredictionHash
    ) {
      return {ok: false, missing: false};
    }
    return {ok: true, payload: seal.payload};
  } catch {
    return {ok: false, missing: false};
  }
}

export function readFixtureView(root: string, expected: ExpectedSeal): FixtureView {
  try {
    const snap = readEnvelope(root, expected);
    const v1 = projectModel(snap.payload.sameCutoffV1);
    const h2 = projectModel(snap.payload.sameCutoffH2);
    const r1 = projectModel(snap.payload.r1);
    const consensus = classifyConsensus(v1, h2, r1);
    const postgame = readPostgame(root, expected);
    if (!postgame.ok && !postgame.missing) {
      return identityView(expected, {});
    }
    if (!postgame.ok) {
      const allPass = v1.status === "PASS" && h2.status === "PASS" && r1.status === "PASS";
      return identityView(expected, {
        v1,
        h2,
        r1,
        consensus,
        evidence: allPass ? "PASS" : "PENDING_RESULT",
        integrity: "verified",
        snapshotShortHash: expected.snapshotHash.slice(0, 8),
        postgame: {status: "RESULT_PENDING"},
      });
    }
    return identityView(expected, {
      v1,
      h2,
      r1,
      consensus,
      evidence: "GRADED",
      integrity: "verified",
      snapshotShortHash: expected.snapshotHash.slice(0, 8),
      postgame: {
        status: "GRADED",
        actualResult: `${postgame.payload.result.regularTime.home}-${postgame.payload.result.regularTime.away}`,
        actualClass: postgame.payload.result.actualClass,
        v1: projectGrade(postgame.payload.v1Grade),
        h2: projectGrade(postgame.payload.h2Grade),
        r1: projectGrade(postgame.payload.r1Grade),
      },
    });
  } catch {
    return identityView(expected, {});
  }
}

function summarize(rows: FixtureView[]): ResearchSummary {
  const visible = rows.filter((r) => r.integrity === "verified");
  const blocked = rows.filter((r) => r.evidence === "INTEGRITY_BLOCKED" || r.evidence === "BLOCKED");
  const graded = visible.filter((r) => r.evidence === "GRADED");
  const pending = visible.filter(
    (r) => r.evidence === "PENDING_RESULT" || r.evidence === "PASS" || r.evidence === "SEALED",
  );
  const r1GradedPredicted = graded.filter(
    (r) => r.postgame.status === "GRADED" && r.postgame.r1.status === "GRADED",
  ).length;
  return {
    sealedTargets: visible.length,
    r1Predicted: visible.filter((r) => r.r1.status === "PREDICTED").length,
    r1Pass: visible.filter((r) => r.r1.status === "PASS").length,
    resultPending: pending.length,
    resultGraded: graded.length,
    resultBlocked: blocked.length,
    r1GradedPredicted,
    checkpoint: {
      label: "R1 graded PREDICTED / 25",
      current: r1GradedPredicted,
      next: CHECKPOINT_N,
    },
  };
}

export function loadResearchConsole(input: {
  env?: NodeJS.ProcessEnv;
  root?: string;
  cwd?: string;
  auditFile?: string;
  expectedAuditSha?: string;
  expectedTargets?: ExpectedSeal[];
  marketFile?: string;
} = {}): ResearchConsoleView {
  const env = input.env ?? process.env;
  const access = researchAccess(env);
  if (access !== "OK") return gatedView(access);

  const root = input.root ?? resolveLocalResearchRoot(env, input.cwd ?? process.cwd());
  if (!localRootAvailable(root)) return gatedView("LOCAL_RESEARCH_DATA_UNAVAILABLE");

  let expected: ExpectedSeal[];
  if (input.expectedTargets) {
    expected = input.expectedTargets;
  } else {
    const auditFile = input.auditFile ?? FIRST_BATCH_AUDIT;
    const expectedSha = input.expectedAuditSha ?? FIRST_BATCH_AUDIT_SHA;
    try {
      if (!existsSync(auditFile)) return gatedView("LOCAL_RESEARCH_DATA_UNAVAILABLE");
      expected = loadSealedTargets(auditFile, expectedSha);
    } catch {
      return gatedView("INTEGRITY_BLOCKED");
    }
  }

  const markets = loadOwnerOnlyMarkets(
    input.marketFile ?? resolveMarketEvidenceFile(env, input.cwd ?? process.cwd()),
  );
  const fixtures = expected
    .map((row) => {
      const view = readFixtureView(root, row);
      return {
        ...view,
        v1: view.v1,
        h2: view.h2,
        r1: view.r1,
        marketComparison: compareSealedToMarket(row, {v1: view.v1, h2: view.h2, r1: view.r1}, markets),
      };
    })
    .sort((a, b) => {
      const ka = Date.parse(a.kickoffUtc);
      const kb = Date.parse(b.kickoffUtc);
      if (ka !== kb) return ka - kb;
      return a.fixtureId - b.fixtureId;
    });

  return {
    schema: SCHEMA,
    gate: "OK",
    sourceMode: SOURCE_MODE,
    route: ROUTE,
    disclaimer: DISCLAIMER,
    modelPromoted: MODEL_PROMOTED,
    r1Role: R1_ROLE,
    summary: summarize(fixtures),
    pending: fixtures.filter(
      (f) => f.evidence === "PENDING_RESULT" || f.evidence === "PASS" || f.evidence === "SEALED",
    ),
    graded: fixtures.filter((f) => f.evidence === "GRADED"),
    blocked: fixtures.filter(
      (f) => f.evidence === "INTEGRITY_BLOCKED" || f.evidence === "BLOCKED",
    ),
    marketType: MARKET_TYPE,
    roundIdentityConfirmed: ROUND_IDENTITY_CONFIRMED,
    marketInputToModel: MARKET_INPUT_TO_MODEL,
    totalsRecommendationEnabled: TOTALS_RECOMMENDATION_ENABLED,
    handicapComparisonEnabled: HANDICAP_COMPARISON_ENABLED,
    marketDisclaimer: MARKET_DISCLAIMER,
    marketSummary: summarizeMarket(fixtures.map((f) => f.marketComparison)),
  };
}

export function assertNoClientPathLeak(text: string): boolean {
  return !/[A-Za-z]:\\/.test(text) && !/\/Users\//.test(text) && !text.includes("YANG-EDGE-INBOX");
}

export {digest};
