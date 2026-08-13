import { computeFootballScheduleArtifactHash } from "../core/hash";
import {
  FOOTBALL_SCHEDULE_V1_SCHEMA,
  type FootballScheduleArtifactV1,
  type FootballScheduleRowV1,
} from "../core/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function assertNotProductGamesPayload(raw: unknown): void {
  if (!isRecord(raw)) return;
  if ("aiAnalysisAvailable" in raw && !("meta" in raw) && !("rows" in raw)) {
    throw new Error(
      "DUMMY_PRODUCT_GAMES_NOT_RESEARCH: constants/games.ts rows cannot become odds evidence",
    );
  }
  if (Array.isArray(raw) && raw.some((row) => isRecord(row) && "aiAnalysisAvailable" in row)) {
    throw new Error(
      "DUMMY_PRODUCT_GAMES_NOT_RESEARCH: constants/games.ts rows cannot become odds evidence",
    );
  }
}

export function parseFootballScheduleArtifact(
  raw: unknown,
): FootballScheduleArtifactV1 {
  assertNotProductGamesPayload(raw);
  if (!isRecord(raw)) {
    throw new Error("SCHEDULE_JSON_INVALID: root must be an object");
  }
  if (!isRecord(raw.meta) || !Array.isArray(raw.rows)) {
    throw new Error("SCHEDULE_JSON_INVALID: missing meta/rows");
  }
  const meta = raw.meta;
  if (meta.schemaVersion !== FOOTBALL_SCHEDULE_V1_SCHEMA) {
    throw new Error(
      `SCHEDULE_SCHEMA_MISMATCH: expected ${FOOTBALL_SCHEDULE_V1_SCHEMA}`,
    );
  }
  if (typeof meta.artifactHash !== "string" || !meta.artifactHash) {
    throw new Error("SCHEDULE_ARTIFACT_HASH_MISSING");
  }

  const doc = raw as FootballScheduleArtifactV1;
  const seen = new Set<string>();
  for (const row of doc.rows) {
    if (!row?.matchId) {
      throw new Error("SCHEDULE_ROW_MATCH_ID_MISSING");
    }
    if (seen.has(row.matchId)) {
      throw new Error(`DUPLICATE_SCHEDULE_MATCH_ID: ${row.matchId}`);
    }
    seen.add(row.matchId);
    if ("aiAnalysisAvailable" in (row as FootballScheduleRowV1 & { aiAnalysisAvailable?: unknown })) {
      throw new Error(
        "DUMMY_PRODUCT_GAMES_NOT_RESEARCH: product row inside schedule",
      );
    }
  }

  const stored = doc.meta.artifactHash;
  const { artifactHash: _storedHash, ...metaWithoutHash } = doc.meta;
  void _storedHash;
  const recomputed = computeFootballScheduleArtifactHash({
    meta: metaWithoutHash,
    rows: doc.rows,
  });
  if (recomputed !== stored) {
    throw new Error(
      `SCHEDULE_ARTIFACT_HASH_MISMATCH: stored=${stored} recomputed=${recomputed}`,
    );
  }
  return doc;
}
