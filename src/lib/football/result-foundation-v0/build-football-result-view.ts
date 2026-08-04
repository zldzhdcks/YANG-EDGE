/**
 * Football Result Foundation view / OS slice.
 */
import { FOOTBALL_IDENTITY_VERSION } from "../foundation/types";
import { resolveFootballResultUsability } from "./resolve-result-usability";
import type { FootballMatchIdentity } from "../foundation/types";
import type {
  FootballResultArtifactMeta,
  FootballResultGateResult,
  FootballResultInputV0,
} from "./types";
import {
  FOOTBALL_RESULT_FOUNDATION_VERSION,
  FOOTBALL_RESULT_RISK_REGISTER_V0,
} from "./types";

export type FootballResultOperationSlice = {
  identityStage: string;
  oddsStage: string;
  resultStage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
  prediction: "NONE";
  usableFinalCount: number;
  notFinalCount: number;
  voidOrCancelledOrPostponedCount: number;
  abandonedReviewCount: number;
  plainLanguage: string;
  gate: FootballResultGateResult;
  sourceRefs: string[];
};

export type FootballResultView = {
  foundationVersion: typeof FOOTBALL_RESULT_FOUNDATION_VERSION;
  identityVersion: typeof FOOTBALL_IDENTITY_VERSION;
  dateKst: string;
  slice: FootballResultOperationSlice;
  developer: {
    usability: string;
    reasons: string[];
    artifactHash: string;
    rows: {
      matchId: string;
      status: string;
      regularTime: string;
      extraTime: string;
      penalties: string;
      resultHash: string | null;
      usability: string;
    }[];
    riskCount: number;
  };
};

export function buildFootballResultView(input: {
  dateKst: string;
  identities: FootballMatchIdentity[];
  rows?: FootballResultInputV0[] | null;
  artifactPresent?: boolean;
  identityStage?: string;
  oddsStage?: string;
}): FootballResultView {
  let rows = input.rows;
  if (input.artifactPresent === false) rows = null;
  else if (input.artifactPresent === true && rows == null) rows = [];

  const map = new Map(input.identities.map((i) => [i.matchId, i]));
  const resolved = resolveFootballResultUsability({
    rows: rows ?? null,
    identitiesByMatchId: map,
  });

  // When only foundation contracts exist (no artifact), stage = FOUNDATION
  let stage = resolved.gate.stage;
  if (rows == null) {
    stage = "FOUNDATION";
    resolved.gate.stage = "FOUNDATION";
    resolved.gate.status = "WARNING";
    resolved.gate.plainLanguage =
      "축구 결과 구조는 준비됐지만 실제 경기 결과 데이터는 아직 수집되지 않았습니다.";
  }

  const slice: FootballResultOperationSlice = {
    identityStage: input.identityStage ?? "FOUNDATION",
    oddsStage: input.oddsStage ?? "NOT_STARTED",
    resultStage: stage,
    prediction: "NONE",
    usableFinalCount: resolved.gate.usableFinalCount,
    notFinalCount: resolved.gate.notFinalCount,
    voidOrCancelledOrPostponedCount:
      resolved.gate.voidOrCancelledOrPostponedCount,
    abandonedReviewCount: resolved.gate.abandonedReviewCount,
    plainLanguage: resolved.gate.plainLanguage,
    gate: resolved.gate,
    sourceRefs: [
      "src/lib/football/result-foundation-v0/",
      FOOTBALL_RESULT_FOUNDATION_VERSION,
    ],
  };

  return {
    foundationVersion: FOOTBALL_RESULT_FOUNDATION_VERSION,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    dateKst: input.dateKst,
    slice,
    developer: {
      usability: resolved.usability,
      reasons: resolved.gate.reasons,
      artifactHash: resolved.artifactHash,
      rows: resolved.resolved.map((r) => ({
        matchId: r.input.matchId,
        status: r.input.status,
        regularTime: `${r.input.regularTime.home}-${r.input.regularTime.away}`,
        extraTime: `${r.input.extraTime.home}-${r.input.extraTime.away}`,
        penalties: `${r.input.penalties.home}-${r.input.penalties.away}`,
        resultHash: r.result?.resultHash ?? null,
        usability: r.usability,
      })),
      riskCount: FOOTBALL_RESULT_RISK_REGISTER_V0.length,
    },
  };
}

export function buildDefaultFootballResultView(
  dateKst: string,
  meta?: { identityStage?: string; oddsStage?: string },
): FootballResultView {
  return buildFootballResultView({
    dateKst,
    identities: [],
    artifactPresent: false,
    identityStage: meta?.identityStage,
    oddsStage: meta?.oddsStage,
  });
}

export function buildOfficialResultsArtifactMeta(input: {
  dateKst: string;
  sourceProvider: string;
  view: FootballResultView;
}): FootballResultArtifactMeta {
  const g = input.view.slice.gate;
  return {
    schemaVersion: "football-official-results-v0",
    generatedAt: new Date().toISOString(),
    dateKst: input.dateKst,
    sourceProvider: input.sourceProvider,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    fixtureCount: input.view.developer.rows.length,
    finalUsableCount: g.usableFinalCount,
    notFinalCount: g.notFinalCount,
    voidCount: input.view.developer.rows.filter((r) => r.status === "VOID")
      .length,
    postponedCount: input.view.developer.rows.filter(
      (r) => r.status === "POSTPONED",
    ).length,
    cancelledCount: input.view.developer.rows.filter(
      (r) => r.status === "CANCELLED",
    ).length,
    conflictCount: g.conflictCount,
    identityFailedCount: input.view.developer.rows.filter((r) =>
      r.usability.includes("IDENTITY"),
    ).length,
    artifactHash: input.view.developer.artifactHash,
  };
}
