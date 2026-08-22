import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  LineupObservationV1,
  LineupPayloadBlobV1,
  LineupRawSnapshotV1,
} from "./types";
import {
  LATEST_ADMISSIBLE_PREGAME_SNAPSHOT_RULE,
  LINEUP_PAYLOAD_SCHEMA,
} from "./types";
import {
  mlbLineupObservationDir,
  mlbLineupObservationRel,
  mlbLineupPayloadDir,
  mlbLineupPayloadRel,
} from "./paths";

export { LATEST_ADMISSIBLE_PREGAME_SNAPSHOT_RULE };

export function hashLineupPayload(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

export function canonicalizeCapturedAt(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.trim();
  return new Date(ms).toISOString();
}

/**
 * observationId = sha256(gamePk + canonicalCapturedAt + payloadHash + provider)
 * Exact same tuple ⇒ idempotent skip. Different capturedAt ⇒ new observation.
 */
export function observationIdFor(input: {
  gamePk: number;
  capturedAt: string;
  payloadHash: string;
  provider: string;
}): string {
  const capturedAt = canonicalizeCapturedAt(input.capturedAt);
  return createHash("sha256")
    .update(
      `${input.gamePk}\n${capturedAt}\n${input.payloadHash}\n${input.provider}`,
      "utf8",
    )
    .digest("hex");
}

async function exists(abs: string): Promise<boolean> {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(abs: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(abs, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function listLineupPayloadHashes(input: {
  dateKst: string;
  gamePk: number;
  cwd?: string;
}): Promise<string[]> {
  const dir = mlbLineupPayloadDir(
    input.dateKst,
    input.gamePk,
    input.cwd ?? process.cwd(),
  );
  try {
    return (await readdir(dir))
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
}

export async function listLineupObservations(input: {
  dateKst: string;
  gamePk: number;
  cwd?: string;
}): Promise<LineupRawSnapshotV1[]> {
  const cwd = input.cwd ?? process.cwd();
  const dir = mlbLineupObservationDir(input.dateKst, input.gamePk, cwd);
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: LineupRawSnapshotV1[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    const obs = await readJsonFile<LineupObservationV1>(path.join(dir, name));
    if (!obs?.observationId) continue;
    const payloadAbs = path.join(
      mlbLineupPayloadDir(input.dateKst, input.gamePk, cwd),
      `${obs.payloadHash}.json`,
    );
    const blob = await readJsonFile<LineupPayloadBlobV1>(payloadAbs);
    out.push({
      ...obs,
      body: blob?.body ?? null,
    });
  }
  return out;
}

/** Compat: hydrated observations (with payload body). */
export const listLineupSnapshots = listLineupObservations;

export type WriteObservationResult = {
  observationWritten: boolean;
  payloadWritten: boolean;
  identicalPayload: boolean;
  exactDuplicate: boolean;
  observationId: string;
  payloadHash: string;
  observationAbs: string;
  payloadAbs: string;
};

export async function writeLineupObservation(
  snapshot: LineupRawSnapshotV1,
  cwd = process.cwd(),
): Promise<WriteObservationResult> {
  const payloadHash = snapshot.payloadHash;
  const observationId =
    snapshot.observationId ||
    observationIdFor({
      gamePk: snapshot.gamePk,
      capturedAt: snapshot.capturedAt,
      payloadHash,
      provider: snapshot.provider,
    });
  const payloadDir = mlbLineupPayloadDir(snapshot.dateKst, snapshot.gamePk, cwd);
  const observationDir = mlbLineupObservationDir(
    snapshot.dateKst,
    snapshot.gamePk,
    cwd,
  );
  const payloadAbs = path.join(payloadDir, `${payloadHash}.json`);
  const observationAbs = path.join(observationDir, `${observationId}.json`);

  const payloadExisted = await exists(payloadAbs);
  const observationExisted = await exists(observationAbs);

  if (!payloadExisted) {
    await mkdir(payloadDir, { recursive: true });
    const blob: LineupPayloadBlobV1 = {
      schemaVersion: LINEUP_PAYLOAD_SCHEMA,
      payloadHash,
      provider: "mlb-stats-api",
      researchOnly: true,
      body: snapshot.body ?? null,
    };
    await writeFile(payloadAbs, `${JSON.stringify(blob, null, 2)}\n`, "utf8");
  }

  if (observationExisted) {
    return {
      observationWritten: false,
      payloadWritten: !payloadExisted,
      identicalPayload: payloadExisted,
      exactDuplicate: true,
      observationId,
      payloadHash,
      observationAbs,
      payloadAbs,
    };
  }

  await mkdir(observationDir, { recursive: true });
  const observation: LineupObservationV1 = {
    ...snapshot,
    observationId,
    payloadHash,
    payloadRel: mlbLineupPayloadRel(
      snapshot.dateKst,
      snapshot.gamePk,
      payloadHash,
    ),
    hash: observationId,
  };
  delete observation.body;
  await writeFile(
    observationAbs,
    `${JSON.stringify(observation, null, 2)}\n`,
    "utf8",
  );
  return {
    observationWritten: true,
    payloadWritten: !payloadExisted,
    identicalPayload: payloadExisted,
    exactDuplicate: false,
    observationId,
    payloadHash,
    observationAbs,
    payloadAbs,
  };
}

/** Compat wrapper. identical payload at a new capturedAt writes a new observation. */
export async function writeLineupSnapshotIfNew(
  snapshot: LineupRawSnapshotV1,
  cwd = process.cwd(),
): Promise<{
  written: boolean;
  duplicate: boolean;
  exactDuplicate: boolean;
  identicalPayload: boolean;
  payloadWritten: boolean;
  observationId: string;
  abs: string;
}> {
  const stored = await writeLineupObservation(snapshot, cwd);
  return {
    written: stored.observationWritten,
    duplicate: stored.exactDuplicate,
    exactDuplicate: stored.exactDuplicate,
    identicalPayload: stored.identicalPayload,
    payloadWritten: stored.payloadWritten,
    observationId: stored.observationId,
    abs: stored.observationAbs,
  };
}

function timestampKey(iso: string | null | undefined): string {
  return iso && iso.trim() !== "" && Number.isFinite(Date.parse(iso))
    ? new Date(Date.parse(iso)).toISOString()
    : "";
}

/** Per-observation event time: sourceTimestamp if valid, else capturedAt. */
export function observationEventTime(
  obs: Pick<LineupObservationV1, "sourceTimestamp" | "capturedAt" | "fetchedAt">,
): string {
  const source = timestampKey(obs.sourceTimestamp);
  if (source) return source;
  return timestampKey(obs.capturedAt ?? obs.fetchedAt);
}

/**
 * Deterministic PRE_GAME ordering. Later eventTime first, then observationId DESC.
 */
export function comparePregameSnapshots(
  a: LineupObservationV1,
  b: LineupObservationV1,
): number {
  const te = observationEventTime(b).localeCompare(observationEventTime(a));
  if (te !== 0) return te;
  return (b.observationId ?? "").localeCompare(a.observationId ?? "");
}

export function latestAdmissiblePregameSnapshot(
  snapshots: LineupObservationV1[],
): LineupObservationV1 | null {
  const pregame = snapshots.filter((s) => s.collectionPhase === "PRE_GAME");
  if (pregame.length === 0) return null;
  return [...pregame].sort(comparePregameSnapshots)[0] ?? null;
}

export function latestConfirmedPregameObservation(
  snapshots: LineupObservationV1[],
): LineupObservationV1 | null {
  const confirmed = snapshots.filter(
    (s) =>
      s.collectionPhase === "PRE_GAME" &&
      s.confirmed === true &&
      s.collectionStatus === "CONFIRMED" &&
      s.homeComplete === true &&
      s.awayComplete === true,
  );
  if (confirmed.length === 0) return null;
  return [...confirmed].sort(comparePregameSnapshots)[0] ?? null;
}

export const pickBestPregameRawSnapshot = latestAdmissiblePregameSnapshot;

export function observationRelOf(obs: LineupObservationV1): string {
  return mlbLineupObservationRel(obs.dateKst, obs.gamePk, obs.observationId);
}
