/**
 * Football Schedule Artifact contract v0 (schema only).
 * Does not write datasets or call providers.
 */
import { FOOTBALL_IDENTITY_VERSION } from "./types";
import type {
  FootballMatchIdentity,
  FootballProviderId,
  FootballScheduleArtifactV1,
} from "./types";

export const FOOTBALL_SCHEDULE_SCHEMA = "football-schedule-v1" as const;

export type BuildScheduleArtifactInput = {
  revision: string;
  generatedAt?: string;
  sourceProvider: FootballProviderId;
  dateKst: string;
  matches: FootballMatchIdentity[];
};

/**
 * Build an in-memory schedule artifact envelope.
 * Callers must supply Match Identity rows that already passed the Identity Gate.
 */
export function buildFootballScheduleArtifactV1(
  input: BuildScheduleArtifactInput,
): FootballScheduleArtifactV1 {
  if (!input.revision?.trim()) {
    throw new Error("SCHEDULE_REVISION_REQUIRED");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("SCHEDULE_DATE_KST_INVALID");
  }
  return {
    schemaVersion: FOOTBALL_SCHEDULE_SCHEMA,
    revision: input.revision.trim(),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceProvider: input.sourceProvider,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    dateKst: input.dateKst,
    matches: input.matches.slice(),
  };
}

export function assertScheduleArtifactContract(
  artifact: FootballScheduleArtifactV1,
): string[] {
  const errors: string[] = [];
  if (artifact.schemaVersion !== FOOTBALL_SCHEDULE_SCHEMA) {
    errors.push("SCHEMA_VERSION_INVALID");
  }
  if (!artifact.revision) errors.push("REVISION_MISSING");
  if (!artifact.generatedAt) errors.push("GENERATED_AT_MISSING");
  if (!artifact.sourceProvider) errors.push("SOURCE_PROVIDER_MISSING");
  if (artifact.identityVersion !== FOOTBALL_IDENTITY_VERSION) {
    errors.push("IDENTITY_VERSION_MISMATCH");
  }
  if (!Array.isArray(artifact.matches)) errors.push("MATCHES_NOT_ARRAY");
  return errors;
}
