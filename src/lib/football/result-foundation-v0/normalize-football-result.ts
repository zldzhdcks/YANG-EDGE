/**
 * Score validation + official result normalization + deterministic resultHash.
 */
import { createHash } from "node:crypto";
import {
  deriveAdvancementWinner,
  deriveOneXTwoOutcome,
  isFinalStatus,
} from "./derive-one-x-two-outcome";
import type {
  FootballOfficialResultV0,
  FootballResultInputV0,
  FootballScorePair,
} from "./types";

export type ScoreValidationResult = {
  ok: boolean;
  reasonCodes: string[];
};

function isNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

function pairOk(p: FootballScorePair, label: string, required: boolean): string[] {
  const codes: string[] = [];
  if (p.home == null && p.away == null) {
    if (required) codes.push(`${label}_MISSING`);
    return codes;
  }
  if (p.home == null || p.away == null) {
    codes.push(`${label}_PARTIAL`);
    return codes;
  }
  if (!isNonNegInt(p.home) || !isNonNegInt(p.away)) {
    codes.push(`${label}_INVALID`);
  }
  return codes;
}

export function validateFootballScores(input: FootballResultInputV0): ScoreValidationResult {
  const reasonCodes: string[] = [];
  const finalLike = isFinalStatus(input.status);

  reasonCodes.push(
    ...pairOk(input.regularTime, "REGULAR_TIME", finalLike),
  );

  if (
    input.finalScore.home != null ||
    input.finalScore.away != null
  ) {
    if (input.regularTime.home == null || input.regularTime.away == null) {
      reasonCodes.push("FINAL_SCORE_WITHOUT_REGULAR_TIME");
    }
    reasonCodes.push(...pairOk(input.finalScore, "FINAL_SCORE", false));
  }

  const hasEt =
    input.extraTime.home != null || input.extraTime.away != null;
  if (hasEt) {
    reasonCodes.push(...pairOk(input.extraTime, "EXTRA_TIME", true));
    if (
      isNonNegInt(input.regularTime.home) &&
      isNonNegInt(input.regularTime.away) &&
      isNonNegInt(input.extraTime.home) &&
      isNonNegInt(input.extraTime.away)
    ) {
      // ET score is full-time including ET; must be >= FT
      if (
        input.extraTime.home < input.regularTime.home ||
        input.extraTime.away < input.regularTime.away
      ) {
        reasonCodes.push("EXTRA_TIME_INCONSISTENT_WITH_REGULAR");
      }
    }
  }

  const hasPen =
    input.penalties.home != null || input.penalties.away != null;
  if (hasPen) {
    reasonCodes.push(...pairOk(input.penalties, "PENALTIES", true));
    if (
      isNonNegInt(input.penalties.home) &&
      isNonNegInt(input.penalties.away) &&
      input.penalties.home === input.penalties.away
    ) {
      reasonCodes.push("PENALTIES_TIE");
    }
  }

  return { ok: reasonCodes.length === 0, reasonCodes };
}

/** Canonical hash payload — no generatedAt / displayName / UI labels. */
export function buildResultHashPayload(
  result: Omit<FootballOfficialResultV0, "resultHash" | "aggregateCollectOnly" | "resultObservedAt" | "sourceStatusRaw"> & {
    resultObservedAt?: never;
  },
): string {
  const rows: [string, string][] = [
    ["advancementWinner", result.advancementWinner],
    ["awayTeamId", result.awayTeamId],
    ["competitionId", result.competitionId],
    ["etA", String(result.extraTime.away)],
    ["etH", String(result.extraTime.home)],
    ["finalA", String(result.finalScore.away)],
    ["finalH", String(result.finalScore.home)],
    ["fixtureId", result.fixtureId],
    ["homeTeamId", result.homeTeamId],
    ["identityHash", result.identityHash],
    ["matchId", result.matchId],
    ["oneXTwoOutcome", result.oneXTwoOutcome],
    ["penA", String(result.penalties.away)],
    ["penH", String(result.penalties.home)],
    ["provider", result.provider],
    ["rtA", String(result.regularTime.away)],
    ["rtH", String(result.regularTime.home)],
    ["season", result.season],
    ["status", result.status],
  ];
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return rows.map(([k, v]) => `${k}=${v}`).join("|");
}

export function computeFootballResultHash(
  payloadSource: Parameters<typeof buildResultHashPayload>[0],
): string {
  return createHash("sha256")
    .update(buildResultHashPayload(payloadSource), "utf8")
    .digest("hex");
}

export type NormalizeResultOutput = {
  result: FootballOfficialResultV0 | null;
  ok: boolean;
  conflict: boolean;
  reasonCodes: string[];
};

export function normalizeFootballResult(
  input: FootballResultInputV0,
): NormalizeResultOutput {
  const scoreVal = validateFootballScores(input);
  const oneXTwo = deriveOneXTwoOutcome({
    status: input.status,
    regularTime: input.regularTime,
  });
  const adv = deriveAdvancementWinner({
    status: input.status,
    regularTime: input.regularTime,
    extraTime: input.extraTime,
    penalties: input.penalties,
    providerAdvancementWinner: input.providerAdvancementWinner,
  });

  const reasonCodes = [...scoreVal.reasonCodes, ...adv.reasonCodes];

  if (adv.conflict) {
    reasonCodes.push("RESULT_CONFLICT");
  }

  if (
    isNonNegInt(input.penalties.home) &&
    isNonNegInt(input.penalties.away) &&
    input.penalties.home !== input.penalties.away
  ) {
    const penWinner =
      input.penalties.home > input.penalties.away ? "HOME" : "AWAY";
    if (
      adv.winner !== "UNRESOLVED" &&
      adv.winner !== "NONE" &&
      adv.winner !== penWinner
    ) {
      reasonCodes.push("PENALTY_WINNER_ADVANCEMENT_MISMATCH");
    }
  }

  if (!scoreVal.ok || oneXTwo === "UNRESOLVED") {
    return {
      result: null,
      ok: false,
      conflict: adv.conflict,
      reasonCodes: [
        ...reasonCodes,
        ...(oneXTwo === "UNRESOLVED" ? ["ONE_X_TWO_UNRESOLVED"] : []),
      ],
    };
  }

  const base = {
    matchId: input.matchId,
    identityHash: input.identityHash,
    provider: input.provider,
    fixtureId: input.fixtureId,
    competitionId: input.competitionId,
    season: input.season,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    status: input.status,
    regularTime: { ...input.regularTime },
    extraTime: { ...input.extraTime },
    penalties: { ...input.penalties },
    finalScore: { ...input.finalScore },
    oneXTwoOutcome: oneXTwo,
    advancementWinner: adv.winner,
  };

  const resultHash = computeFootballResultHash(base);

  const result: FootballOfficialResultV0 = {
    ...base,
    resultObservedAt: input.resultObservedAt,
    sourceStatusRaw: input.sourceStatusRaw,
    resultHash,
    aggregateCollectOnly: {
      aggregateHome: input.aggregateHome ?? null,
      aggregateAway: input.aggregateAway ?? null,
      legNumber: input.legNumber ?? null,
      tieId: input.tieId ?? null,
    },
  };

  return {
    result,
    ok: !adv.conflict && scoreVal.ok,
    conflict: adv.conflict,
    reasonCodes,
  };
}

/** Fields excluded from hash — for tests. */
export function resultHashIgnoresFields(): string[] {
  return [
    "generatedAt",
    "fetchedAt",
    "displayName",
    "uiLabel",
    "locale",
    "resultObservedAt",
    "sourceStatusRaw",
  ];
}
