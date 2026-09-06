import { createHash } from "node:crypto";
import type { RowContentFingerprintInput } from "./types";

/**
 * Layer 2 content identity. Must NOT include source image SHA-256,
 * otherwise overlapping scrolled screenshots can never collapse.
 */
export function buildRowContentFingerprint(
  input: RowContentFingerprintInput,
): string {
  const payload = {
    protoRoundKey: input.protoRoundKey,
    sportTextRaw: input.sportTextRaw,
    leagueTextRaw: input.leagueTextRaw,
    scheduledDateTextRaw: input.scheduledDateTextRaw,
    scheduledTimeTextRaw: input.scheduledTimeTextRaw,
    leftTeamTextRaw: input.leftTeamTextRaw,
    rightTeamTextRaw: input.rightTeamTextRaw,
    leftTeamNormalized: input.leftTeamNormalized,
    rightTeamNormalized: input.rightTeamNormalized,
    marketTypeRaw: input.marketTypeRaw,
    handicapLineRaw: input.handicapLineRaw,
    totalLineRaw: input.totalLineRaw,
    oddsValuesRaw: input.oddsValuesRaw,
  };
  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

/**
 * Observation identity = content + accepted observation time.
 * Same row content at different accepted times stays distinct.
 */
export function buildObservationIdentity(
  rowContentFingerprint: string,
  acceptedObservationTime: string | null,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        rowContentFingerprint,
        acceptedObservationTime,
      }),
      "utf8",
    )
    .digest("hex");
}

/** Normalized labels are added beside raw screen text. Raw is never overwritten. */
export function attachNormalizedTeams(
  raw: { leftTeamTextRaw: string; rightTeamTextRaw: string },
  leftTeamNormalized: string,
  rightTeamNormalized: string,
): {
  leftTeamTextRaw: string;
  rightTeamTextRaw: string;
  leftTeamNormalized: string;
  rightTeamNormalized: string;
} {
  return {
    leftTeamTextRaw: raw.leftTeamTextRaw,
    rightTeamTextRaw: raw.rightTeamTextRaw,
    leftTeamNormalized,
    rightTeamNormalized,
  };
}
