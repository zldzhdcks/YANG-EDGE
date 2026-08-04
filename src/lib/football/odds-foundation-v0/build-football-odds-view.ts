/**
 * Build Football odds foundation view / OS slice.
 * No provider calls. No production artifact writes.
 */
import { FOOTBALL_IDENTITY_VERSION } from "../foundation/types";
import { resolveFootballOddsUsability } from "./resolve-odds-usability";
import type { FootballMatchIdentity } from "../foundation/types";
import type {
  FootballCollectOnlyOddsRow,
  FootballDomesticMarketsArtifactV1,
  FootballOddsHistoryArtifactV1,
  FootballOddsOperationSlice,
  FootballOddsUsabilityArtifactV1,
  FootballOneXTwoOddsRow,
} from "./types";
import { FOOTBALL_ODDS_FOUNDATION_VERSION } from "./types";

export type BuildFootballOddsViewInput = {
  dateKst: string;
  identities: FootballMatchIdentity[];
  overseasRows?: FootballOneXTwoOddsRow[] | null;
  domesticRows?: FootballOneXTwoOddsRow[] | null;
  collectOnlyRows?: FootballCollectOnlyOddsRow[] | null;
  expectedMatchCount?: number | null;
  artifactPresent?: boolean;
};

export type FootballOddsView = {
  foundationVersion: typeof FOOTBALL_ODDS_FOUNDATION_VERSION;
  identityVersion: typeof FOOTBALL_IDENTITY_VERSION;
  dateKst: string;
  slice: FootballOddsOperationSlice;
  developer: {
    usability: string;
    reasons: string[];
    artifactHash: string;
    overrounds: { matchId: string; overround: number | null; namespace: string }[];
    identityJoinsFailed: number;
    namespaces: { overseasRows: number; domesticRows: number };
  };
};

export function buildFootballOddsView(
  input: BuildFootballOddsViewInput,
): FootballOddsView {
  const map = new Map(input.identities.map((i) => [i.matchId, i]));

  let overseas = input.overseasRows;
  let domestic = input.domesticRows;
  if (input.artifactPresent === false) {
    overseas = null;
    domestic = null;
  } else if (
    input.artifactPresent === true &&
    overseas == null &&
    domestic == null
  ) {
    overseas = [];
    domestic = [];
  }

  const resolved = resolveFootballOddsUsability({
    overseasRows: overseas ?? null,
    domesticRows: domestic ?? null,
    collectOnlyRows: input.collectOnlyRows ?? null,
    identitiesByMatchId: map,
    expectedMatchCount: input.expectedMatchCount,
  });

  const slice: FootballOddsOperationSlice = {
    identityStage: "FOUNDATION",
    oddsStage: resolved.gate.stage,
    prediction: "NONE",
    usableMatchCount: resolved.gate.usableMatches,
    blockedReasonPlain:
      resolved.gate.status === "BLOCKED" || resolved.gate.status === "OFF"
        ? resolved.gate.plainLanguage
        : null,
    gate: resolved.gate,
    sourceRefs: [
      "src/lib/football/odds-foundation-v0/",
      FOOTBALL_ODDS_FOUNDATION_VERSION,
    ],
  };

  return {
    foundationVersion: FOOTBALL_ODDS_FOUNDATION_VERSION,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    dateKst: input.dateKst,
    slice,
    developer: {
      usability: resolved.usability,
      reasons: resolved.gate.reasons,
      artifactHash: resolved.artifactHash,
      overrounds: resolved.resolved.map((r) => ({
        matchId: r.row.matchId,
        overround: r.overround,
        namespace: r.namespace,
      })),
      identityJoinsFailed: resolved.resolved.filter((r) =>
        r.reasonCodes.includes("IDENTITY_UNRESOLVED"),
      ).length,
      namespaces: {
        overseasRows: overseas?.length ?? 0,
        domesticRows: domestic?.length ?? 0,
      },
    },
  };
}

/** Default OS view when no research odds collected yet. */
export function buildDefaultFootballOddsView(dateKst: string): FootballOddsView {
  return buildFootballOddsView({
    dateKst,
    identities: [],
    artifactPresent: false,
  });
}

export function buildOddsHistoryArtifactEnvelope(input: {
  dateKst: string;
  generatedAt?: string;
  sourceProvider: string;
  rows: FootballOneXTwoOddsRow[];
  collectOnlyRows?: FootballCollectOnlyOddsRow[];
  artifactHash: string;
  usableCount: number;
  partialCount: number;
  notCollectedCount: number;
  afterCutoffCount: number;
  identityFailedCount: number;
}): FootballOddsHistoryArtifactV1 {
  return {
    schemaVersion: "football-odds-history-v1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dateKst: input.dateKst,
    sourceProvider: input.sourceProvider,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    sourceNamespace: "OVERSEAS",
    rows: input.rows.length,
    usableCount: input.usableCount,
    partialCount: input.partialCount,
    notCollectedCount: input.notCollectedCount,
    afterCutoffCount: input.afterCutoffCount,
    identityFailedCount: input.identityFailedCount,
    artifactHash: input.artifactHash,
    oneXTwoRows: input.rows,
    collectOnlyRows: input.collectOnlyRows ?? [],
  };
}

export function buildDomesticMarketsArtifactEnvelope(input: {
  dateKst: string;
  generatedAt?: string;
  sourceProvider: string;
  rows: FootballOneXTwoOddsRow[];
  collectOnlyRows?: FootballCollectOnlyOddsRow[];
  artifactHash: string;
  usableCount: number;
  partialCount: number;
  notCollectedCount: number;
  afterCutoffCount: number;
  identityFailedCount: number;
}): FootballDomesticMarketsArtifactV1 {
  return {
    schemaVersion: "football-domestic-markets-v1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dateKst: input.dateKst,
    sourceProvider: input.sourceProvider,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    sourceNamespace: "DOMESTIC",
    rows: input.rows.length,
    usableCount: input.usableCount,
    partialCount: input.partialCount,
    notCollectedCount: input.notCollectedCount,
    afterCutoffCount: input.afterCutoffCount,
    identityFailedCount: input.identityFailedCount,
    artifactHash: input.artifactHash,
    oneXTwoRows: input.rows,
    collectOnlyRows: input.collectOnlyRows ?? [],
  };
}

export function buildUsabilityArtifactEnvelope(input: {
  dateKst: string;
  sourceProvider: string;
  sourceNamespace: "OVERSEAS" | "DOMESTIC";
  view: FootballOddsView;
}): FootballOddsUsabilityArtifactV1 {
  const g = input.view.slice.gate;
  return {
    schemaVersion: "football-odds-usability-v1",
    generatedAt: new Date().toISOString(),
    dateKst: input.dateKst,
    sourceProvider: input.sourceProvider,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    sourceNamespace: input.sourceNamespace,
    rows: input.view.developer.namespaces.overseasRows +
      input.view.developer.namespaces.domesticRows,
    usableCount: g.usableMatches,
    partialCount: g.stage === "PARTIAL" ? 1 : 0,
    notCollectedCount: g.usability === "ARTIFACT_MISSING" ? 1 : 0,
    afterCutoffCount: g.usability === "AFTER_CUTOFF" ? 1 : 0,
    identityFailedCount: input.view.developer.identityJoinsFailed,
    artifactHash: input.view.developer.artifactHash,
    usability: g.usability,
    predictionAllowed: g.predictionAllowed,
    reasons: g.reasons,
  };
}
