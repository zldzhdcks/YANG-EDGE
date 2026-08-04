/**
 * Result usability — artifact exists ≠ grade usable.
 */
import { createHash } from "node:crypto";
import { isFinalStatus, isNonGradableTerminal } from "./derive-one-x-two-outcome";
import { joinResultToIdentity } from "./identity-join";
import { normalizeFootballResult } from "./normalize-football-result";
import { toFootballReviewResultAdapter } from "./review-result-adapter";
import type { FootballMatchIdentity } from "../foundation/types";
import type {
  FootballOfficialResultV0,
  FootballResultGateResult,
  FootballResultInputV0,
  FootballResultUsabilityStatus,
  FootballReviewResultAdapterV0,
} from "./types";

export type ResolveResultUsabilityInput = {
  rows: FootballResultInputV0[] | null;
  identitiesByMatchId: Map<string, FootballMatchIdentity>;
};

export type ResolvedResultRow = {
  input: FootballResultInputV0;
  result: FootballOfficialResultV0 | null;
  usability: FootballResultUsabilityStatus;
  gradingAllowed: boolean;
  reasonCodes: string[];
  adapter: FootballReviewResultAdapterV0 | null;
};

export type ResolveResultUsabilityResult = {
  usability: FootballResultUsabilityStatus;
  gate: FootballResultGateResult;
  resolved: ResolvedResultRow[];
  artifactHash: string;
};

function hashPayload(v: unknown): string {
  return createHash("sha256").update(JSON.stringify(v), "utf8").digest("hex");
}

function usabilityForRow(
  input: FootballResultInputV0,
  identity: FootballMatchIdentity | undefined,
): ResolvedResultRow {
  if (!identity) {
    return {
      input,
      result: null,
      usability: "IDENTITY_UNRESOLVED",
      gradingAllowed: false,
      reasonCodes: ["IDENTITY_MISSING_FOR_MATCH", "IDENTITY_UNRESOLVED"],
      adapter: null,
    };
  }

  const join = joinResultToIdentity(input, identity);
  if (!join.ok) {
    const usability: FootballResultUsabilityStatus =
      join.orientation === "REVERSED_SUSPECTED"
        ? "REVERSED_RESULT_SUSPECTED"
        : "IDENTITY_UNRESOLVED";
    return {
      input,
      result: null,
      usability,
      gradingAllowed: false,
      reasonCodes: join.reasonCodes,
      adapter: null,
    };
  }

  if (input.status === "UNKNOWN") {
    return {
      input,
      result: null,
      usability: "STATUS_UNKNOWN",
      gradingAllowed: false,
      reasonCodes: ["STATUS_UNKNOWN"],
      adapter: null,
    };
  }

  if (input.status === "POSTPONED") {
    return {
      input,
      result: null,
      usability: "POSTPONED_NOT_GRADED",
      gradingAllowed: false,
      reasonCodes: ["POSTPONED"],
      adapter: null,
    };
  }
  if (input.status === "CANCELLED") {
    return {
      input,
      result: null,
      usability: "CANCELLED_NOT_GRADED",
      gradingAllowed: false,
      reasonCodes: ["CANCELLED"],
      adapter: null,
    };
  }
  if (input.status === "VOID") {
    return {
      input,
      result: null,
      usability: "VOID_NOT_GRADED",
      gradingAllowed: false,
      reasonCodes: ["VOID"],
      adapter: null,
    };
  }
  if (input.status === "SUSPENDED") {
    return {
      input,
      result: null,
      usability: "SUSPENDED_NOT_GRADED",
      gradingAllowed: false,
      reasonCodes: ["SUSPENDED"],
      adapter: null,
    };
  }
  if (input.status === "ABANDONED") {
    return {
      input,
      result: null,
      usability: "ABANDONED_REVIEW_REQUIRED",
      gradingAllowed: false,
      reasonCodes: ["ABANDONED"],
      adapter: null,
    };
  }

  if (!isFinalStatus(input.status) || isNonGradableTerminal(input.status)) {
    return {
      input,
      result: null,
      usability: "NOT_FINAL",
      gradingAllowed: false,
      reasonCodes: ["NOT_FINAL"],
      adapter: null,
    };
  }

  const normalized = normalizeFootballResult(input);
  if (normalized.conflict) {
    return {
      input,
      result: normalized.result,
      usability: "RESULT_CONFLICT",
      gradingAllowed: false,
      reasonCodes: normalized.reasonCodes,
      adapter: normalized.result
        ? toFootballReviewResultAdapter({
            result: normalized.result,
            usability: "RESULT_CONFLICT",
          })
        : null,
    };
  }

  if (!normalized.ok || !normalized.result) {
    return {
      input,
      result: null,
      usability: "INVALID_SCORE",
      gradingAllowed: false,
      reasonCodes: normalized.reasonCodes,
      adapter: null,
    };
  }

  let usability: FootballResultUsabilityStatus = "FINAL_USABLE";
  if (input.status === "FINAL_AFTER_EXTRA_TIME") {
    usability = "FINAL_AFTER_EXTRA_TIME_USABLE";
  } else if (input.status === "FINAL_AFTER_PENALTIES") {
    usability = "FINAL_AFTER_PENALTIES_USABLE";
  }

  const adapter = toFootballReviewResultAdapter({
    result: normalized.result,
    usability,
  });

  return {
    input,
    result: normalized.result,
    usability,
    gradingAllowed: adapter.gradingAllowed,
    reasonCodes: normalized.reasonCodes,
    adapter,
  };
}

function plainLanguage(
  u: FootballResultUsabilityStatus,
  counts: {
    usable: number;
    notFinal: number;
    voidish: number;
    abandoned: number;
    total: number;
  },
): string {
  if (u === "RESULT_ARTIFACT_MISSING") {
    return "축구 결과 구조는 준비됐지만 실제 경기 결과 데이터는 아직 수집되지 않았습니다.";
  }
  if (counts.total > 0) {
    return `${counts.total}경기 중 ${counts.usable}경기는 최종 결과가 확인됐고, ${counts.notFinal}경기는 진행 중이며 ${counts.voidish}경기는 취소·연기·무효, ${counts.abandoned}경기는 검토가 필요합니다.`;
  }
  return "축구 결과 상태를 확인할 수 없습니다.";
}

export function resolveFootballResultUsability(
  input: ResolveResultUsabilityInput,
): ResolveResultUsabilityResult {
  if (input.rows == null) {
    const usability: FootballResultUsabilityStatus = "RESULT_ARTIFACT_MISSING";
    const gate: FootballResultGateResult = {
      status: "OFF",
      gradingAllowed: false,
      usableFinalCount: 0,
      notFinalCount: 0,
      voidOrCancelledOrPostponedCount: 0,
      abandonedReviewCount: 0,
      conflictCount: 0,
      reasons: ["RESULT_ARTIFACT_MISSING"],
      usability,
      stage: "NOT_STARTED",
      plainLanguage: plainLanguage(usability, {
        usable: 0,
        notFinal: 0,
        voidish: 0,
        abandoned: 0,
        total: 0,
      }),
      progressPercent: null,
    };
    return {
      usability,
      gate,
      resolved: [],
      artifactHash: hashPayload({ empty: true }),
    };
  }

  const resolved = input.rows.map((row) =>
    usabilityForRow(row, input.identitiesByMatchId.get(row.matchId)),
  );

  const usableFinalCount = resolved.filter((r) => r.gradingAllowed).length;
  const notFinalCount = resolved.filter(
    (r) => r.usability === "NOT_FINAL",
  ).length;
  const voidOrCancelledOrPostponedCount = resolved.filter((r) =>
    [
      "VOID_NOT_GRADED",
      "POSTPONED_NOT_GRADED",
      "CANCELLED_NOT_GRADED",
      "SUSPENDED_NOT_GRADED",
    ].includes(r.usability),
  ).length;
  const abandonedReviewCount = resolved.filter(
    (r) => r.usability === "ABANDONED_REVIEW_REQUIRED",
  ).length;
  const conflictCount = resolved.filter(
    (r) =>
      r.usability === "RESULT_CONFLICT" ||
      r.usability === "IDENTITY_UNRESOLVED" ||
      r.usability === "REVERSED_RESULT_SUSPECTED" ||
      r.usability === "INVALID_SCORE",
  ).length;

  let usability: FootballResultUsabilityStatus;
  if (input.rows.length === 0) {
    usability = "RESULT_ARTIFACT_MISSING";
  } else if (usableFinalCount > 0 && conflictCount === 0) {
    usability =
      resolved.find((r) => r.gradingAllowed)?.usability ?? "FINAL_USABLE";
  } else if (usableFinalCount > 0) {
    usability = "FINAL_USABLE";
  } else if (abandonedReviewCount > 0) {
    usability = "ABANDONED_REVIEW_REQUIRED";
  } else if (
    resolved.some((r) => r.usability === "RESULT_CONFLICT")
  ) {
    usability = "RESULT_CONFLICT";
  } else if (
    resolved.every((r) =>
      [
        "POSTPONED_NOT_GRADED",
        "CANCELLED_NOT_GRADED",
        "VOID_NOT_GRADED",
        "SUSPENDED_NOT_GRADED",
      ].includes(r.usability),
    )
  ) {
    usability = resolved[0]!.usability;
  } else if (resolved.some((r) => r.usability === "IDENTITY_UNRESOLVED")) {
    usability = "IDENTITY_UNRESOLVED";
  } else if (resolved.some((r) => r.usability === "INVALID_SCORE")) {
    usability = "INVALID_SCORE";
  } else {
    usability = "NOT_FINAL";
  }

  let status: FootballResultGateResult["status"];
  let stage: FootballResultGateResult["stage"];
  if (input.rows.length === 0) {
    status = "OFF";
    stage = "NOT_STARTED";
  } else if (usableFinalCount > 0 && conflictCount === 0) {
    status = "READY";
    stage = "READY";
  } else if (usableFinalCount > 0) {
    status = "WARNING";
    stage = "FOUNDATION";
  } else if (
    usability === "NOT_FINAL" ||
    usability === "RESULT_ARTIFACT_MISSING"
  ) {
    status = "WARNING";
    stage = "FOUNDATION";
  } else {
    status = "BLOCKED";
    stage = "BLOCKED";
  }

  // Empty artifact present → NOT_STARTED/FOUNDATION with OFF-ish
  if (input.rows.length === 0) {
    usability = "RESULT_ARTIFACT_MISSING";
    status = "OFF";
    stage = "NOT_STARTED";
  }

  const gate: FootballResultGateResult = {
    status,
    gradingAllowed: usableFinalCount > 0 && status !== "BLOCKED",
    usableFinalCount,
    notFinalCount,
    voidOrCancelledOrPostponedCount,
    abandonedReviewCount,
    conflictCount,
    reasons: resolved.flatMap((r) => r.reasonCodes).slice(0, 40),
    usability,
    stage: stage === "NOT_STARTED" && input.rows.length >= 0 ? (input.rows.length === 0 ? "NOT_STARTED" : stage) : stage,
    plainLanguage: plainLanguage(usability, {
      usable: usableFinalCount,
      notFinal: notFinalCount,
      voidish: voidOrCancelledOrPostponedCount,
      abandoned: abandonedReviewCount,
      total: input.rows.length,
    }),
    progressPercent: null,
  };

  // Foundation stage when contracts exist but no production data ingested yet
  // is handled by buildDefault which passes null rows.

  return {
    usability,
    gate,
    resolved,
    artifactHash: hashPayload(
      resolved.map((r) => ({
        matchId: r.input.matchId,
        usability: r.usability,
        hash: r.result?.resultHash ?? null,
        oneXTwo: r.result?.oneXTwoOutcome ?? null,
      })),
    ),
  };
}
