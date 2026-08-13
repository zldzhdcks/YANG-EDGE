/**
 * Fail-loud loader for Football Prediction Snapshot v0.
 * Market Baseline must read Snapshot only through this module.
 * Does not read Schedule or Odds artifacts.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { computeFootball1x2OddsObservationHash } from "../odds-1x2-v1/hash";
import { isOddsIsoInstant } from "../odds-1x2-v1/instant";
import { computeFootballPredictionSnapshotHash } from "./hash";
import { footballPredictionSnapshotV0Rel } from "./paths";
import { assertFrozenOddsObservationProvenance } from "./provenance";
import {
  FOOTBALL_PREDICTION_SNAPSHOT_V0_SCHEMA,
  isFootballSnapshotMatchStatus,
  type FootballPredictionSnapshotV0,
  type FootballSnapshotMatchV0,
} from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function assertFrozenRowIntegrity(
  match: FootballSnapshotMatchV0,
  sourceScheduleArtifactHashAtFreeze: string,
): void {
  const obs = match.frozenOddsObservation;
  if (
    obs == null ||
    match.selectedOddsObservationId == null ||
    match.selectedOddsObservationHash == null
  ) {
    throw new Error(
      `FOOTBALL_PREDICTION_SNAPSHOT_FROZEN_ODDS_MISSING: matchId=${match.matchId}`,
    );
  }
  if (match.selectedOddsObservationId !== obs.observationId) {
    throw new Error(
      `FOOTBALL_PREDICTION_SNAPSHOT_OBSERVATION_ID_MISMATCH: matchId=${match.matchId} selected=${match.selectedOddsObservationId} frozen=${obs.observationId}`,
    );
  }
  const recomputed = computeFootball1x2OddsObservationHash(obs);
  if (recomputed !== match.selectedOddsObservationHash) {
    throw new Error(
      `FOOTBALL_PREDICTION_SNAPSHOT_OBSERVATION_HASH_MISMATCH: matchId=${match.matchId} stored=${match.selectedOddsObservationHash} recomputed=${recomputed}`,
    );
  }
  assertFrozenOddsObservationProvenance({
    row: match.frozenScheduleRow,
    observation: obs,
    scheduleArtifactHash: sourceScheduleArtifactHashAtFreeze,
  });
}

export function parseFootballPredictionSnapshotJsonText(
  text: string,
  options?: { dateKst?: string },
): FootballPredictionSnapshotV0 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("FOOTBALL_PREDICTION_SNAPSHOT_JSON_INVALID");
  }
  return parseFootballPredictionSnapshotArtifact(parsed, options);
}

export function parseFootballPredictionSnapshotArtifact(
  raw: unknown,
  options?: { dateKst?: string },
): FootballPredictionSnapshotV0 {
  if (!isRecord(raw)) {
    throw new Error(
      "FOOTBALL_PREDICTION_SNAPSHOT_STRUCTURE_INVALID: root must be an object",
    );
  }
  if (!isRecord(raw.meta) || !Array.isArray(raw.matches)) {
    throw new Error(
      "FOOTBALL_PREDICTION_SNAPSHOT_STRUCTURE_INVALID: missing meta/matches",
    );
  }
  const schema = raw.meta.schemaVersion;
  if (schema !== FOOTBALL_PREDICTION_SNAPSHOT_V0_SCHEMA) {
    throw new Error(
      `FOOTBALL_PREDICTION_SNAPSHOT_SCHEMA_MISMATCH: expected ${FOOTBALL_PREDICTION_SNAPSHOT_V0_SCHEMA} got=${String(schema)}`,
    );
  }
  if (raw.meta.researchOnly !== true) {
    throw new Error("FOOTBALL_PREDICTION_SNAPSHOT_RESEARCH_ONLY_REQUIRED");
  }
  if (raw.meta.prediction !== "NONE") {
    throw new Error("FOOTBALL_PREDICTION_SNAPSHOT_PREDICTION_NOT_NONE");
  }
  if (raw.meta.engine !== "NONE") {
    throw new Error("FOOTBALL_PREDICTION_SNAPSHOT_ENGINE_NOT_NONE");
  }
  const stored = raw.meta.snapshotHash;
  if (typeof stored !== "string" || !stored) {
    throw new Error("FOOTBALL_PREDICTION_SNAPSHOT_HASH_MISSING");
  }
  if (typeof raw.meta.freezeAt !== "string" || !isOddsIsoInstant(raw.meta.freezeAt)) {
    throw new Error("FOOTBALL_PREDICTION_SNAPSHOT_FREEZE_AT_INVALID");
  }
  const freezeAt = raw.meta.freezeAt;
  const freezeMs = Date.parse(freezeAt);
  if (
    options?.dateKst != null &&
    raw.meta.dateKst !== options.dateKst
  ) {
    throw new Error(
      `FOOTBALL_PREDICTION_SNAPSHOT_DATE_MISMATCH: file=${String(raw.meta.dateKst)} arg=${options.dateKst}`,
    );
  }

  const doc = raw as FootballPredictionSnapshotV0;
  const seen = new Set<string>();
  for (const match of doc.matches) {
    if (!isRecord(match) || typeof match.matchId !== "string") {
      throw new Error(
        "FOOTBALL_PREDICTION_SNAPSHOT_STRUCTURE_INVALID: matchId",
      );
    }
    if (seen.has(match.matchId)) {
      throw new Error(
        `FOOTBALL_PREDICTION_SNAPSHOT_DUPLICATE_MATCH_ID: ${match.matchId}`,
      );
    }
    seen.add(match.matchId);
    if (!isRecord(match.frozenScheduleRow)) {
      throw new Error(
        `FOOTBALL_PREDICTION_SNAPSHOT_STRUCTURE_INVALID: frozenScheduleRow matchId=${match.matchId}`,
      );
    }
    if (match.matchId !== match.frozenScheduleRow.matchId) {
      throw new Error(
        `FOOTBALL_PREDICTION_SNAPSHOT_MATCH_ID_MISMATCH: wrapper=${match.matchId} schedule=${String(match.frozenScheduleRow.matchId)}`,
      );
    }
    if (!isFootballSnapshotMatchStatus(match.snapshotStatus)) {
      throw new Error(
        `FOOTBALL_PREDICTION_SNAPSHOT_STATUS_INVALID: matchId=${match.matchId} status=${String(match.snapshotStatus)}`,
      );
    }
    if (match.snapshotStatus === "FROZEN") {
      const kickoff = match.frozenScheduleRow.kickoffTimeUtc;
      if (typeof kickoff !== "string" || !isOddsIsoInstant(kickoff)) {
        throw new Error(
          `FOOTBALL_PREDICTION_SNAPSHOT_FROZEN_KICKOFF_INVALID: matchId=${match.matchId}`,
        );
      }
      const kickoffMs = Date.parse(kickoff);
      if (!(freezeMs < kickoffMs)) {
        throw new Error(
          `FOOTBALL_PREDICTION_SNAPSHOT_FREEZE_NOT_BEFORE_KICKOFF: matchId=${match.matchId} freezeAt=${freezeAt} kickoff=${kickoff}`,
        );
      }
      assertFrozenRowIntegrity(
        match,
        doc.meta.sourceScheduleArtifactHashAtFreeze,
      );
    }
  }

  const { snapshotHash: _storedHash, ...metaWithoutHash } = doc.meta;
  void _storedHash;
  const recomputed = computeFootballPredictionSnapshotHash({
    meta: metaWithoutHash,
    matches: doc.matches,
  });
  if (recomputed !== stored) {
    throw new Error(
      `FOOTBALL_PREDICTION_SNAPSHOT_HASH_MISMATCH: stored=${stored} recomputed=${recomputed}`,
    );
  }
  return doc;
}

export async function loadFootballPredictionSnapshotV0(input: {
  dateKst: string;
  rootDir?: string;
}): Promise<FootballPredictionSnapshotV0> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("FOOTBALL_PREDICTION_SNAPSHOT_DATE_KST_INVALID");
  }
  const root = input.rootDir ?? process.cwd();
  const rel = footballPredictionSnapshotV0Rel(input.dateKst);
  const abs = path.join(root, rel);
  let text: string;
  try {
    text = await readFile(abs, "utf8");
  } catch {
    throw new Error(`FOOTBALL_PREDICTION_SNAPSHOT_MISSING: ${rel}`);
  }
  return parseFootballPredictionSnapshotJsonText(text, {
    dateKst: input.dateKst,
  });
}
