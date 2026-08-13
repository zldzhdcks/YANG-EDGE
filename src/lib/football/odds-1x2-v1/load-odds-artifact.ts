import { computeFootball1x2OddsArtifactHash } from "./hash";
import {
  FOOTBALL_1X2_ODDS_V1_SCHEMA,
  type Football1x2OddsArtifactV1,
} from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function isEnoentError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

export function parseFootball1x2OddsJsonText(
  text: string,
): Football1x2OddsArtifactV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("ODDS_ARTIFACT_JSON_INVALID");
  }
  return parseFootball1x2OddsArtifact(parsed);
}

export function parseFootball1x2OddsArtifact(
  raw: unknown,
): Football1x2OddsArtifactV1 {
  if (!isRecord(raw)) {
    throw new Error("ODDS_ARTIFACT_STRUCTURE_INVALID: root must be an object");
  }
  if (!isRecord(raw.meta) || !Array.isArray(raw.observations)) {
    throw new Error("ODDS_ARTIFACT_STRUCTURE_INVALID: missing meta/observations");
  }
  const schema = raw.meta.schemaVersion;
  if (schema !== FOOTBALL_1X2_ODDS_V1_SCHEMA) {
    throw new Error(
      `ODDS_ARTIFACT_SCHEMA_MISMATCH: expected ${FOOTBALL_1X2_ODDS_V1_SCHEMA} got=${String(schema)}`,
    );
  }
  const stored = raw.meta.artifactHash;
  if (typeof stored !== "string" || !stored) {
    throw new Error("ODDS_ARTIFACT_HASH_MISSING");
  }

  const doc = raw as Football1x2OddsArtifactV1;
  if (typeof doc.meta.sourceScheduleArtifactHash !== "string") {
    throw new Error("ODDS_ARTIFACT_STRUCTURE_INVALID: sourceScheduleArtifactHash");
  }
  for (const obs of doc.observations) {
    if (!isRecord(obs) || typeof obs.observationId !== "string") {
      throw new Error("ODDS_ARTIFACT_STRUCTURE_INVALID: observationId");
    }
  }

  const { artifactHash: _storedHash, ...metaWithoutHash } = doc.meta;
  void _storedHash;
  const recomputed = computeFootball1x2OddsArtifactHash({
    meta: metaWithoutHash,
    observations: doc.observations,
  });
  if (recomputed !== stored) {
    throw new Error(
      `ODDS_ARTIFACT_HASH_MISMATCH: stored=${stored} recomputed=${recomputed}`,
    );
  }
  return doc;
}
