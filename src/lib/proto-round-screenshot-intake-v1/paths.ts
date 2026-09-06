import path from "node:path";
import type { ProtoRoundIdentity } from "./types";

export const PROTO_ROUNDS_ROOT = "PROTO_ROUNDS";
export const INBOX_DIR_NAME = "INBOX";
export const YANG_EDGE_DIR_NAME = ".yang-edge";
export const ROUND_CONFIG_FILE_NAME = "round.json";
export const INTAKE_MANIFEST_FILE_NAME = "intake-manifest-v1.json";

export const MIN_PROTO_YEAR = 2000;
export const MAX_PROTO_YEAR = 2100;
export const MIN_PROTO_ROUND = 1;
export const MAX_PROTO_ROUND = 9999;

export function toPosixPath(p: string): string {
  return p.replaceAll("\\", "/");
}

export function comparePosixPath(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Year/round must be integers. Path-traversal strings, 0, negatives,
 * NaN, and non-integers are rejected before any filesystem join.
 */
export function assertSafeProtoRoundCoords(
  year: unknown,
  round: unknown,
): { year: number; round: number } {
  if (
    typeof year !== "number" ||
    !Number.isInteger(year) ||
    year < MIN_PROTO_YEAR ||
    year > MAX_PROTO_YEAR
  ) {
    throw new Error("INVALID_PROTO_ROUND_YEAR");
  }
  if (
    typeof round !== "number" ||
    !Number.isInteger(round) ||
    round < MIN_PROTO_ROUND ||
    round > MAX_PROTO_ROUND
  ) {
    throw new Error("INVALID_PROTO_ROUND_ROUND");
  }
  return { year, round };
}

export function roundLabel(round: number): string {
  assertSafeProtoRoundCoords(2000, round);
  return `${round}회차`;
}

export function protoRoundKey(year: number, round: number): string {
  const safe = assertSafeProtoRoundCoords(year, round);
  return `${safe.year}-${safe.round}`;
}

export function protoRoundIdentity(
  year: number,
  round: number,
): ProtoRoundIdentity {
  const safe = assertSafeProtoRoundCoords(year, round);
  return {
    year: safe.year,
    round: safe.round,
    roundLabel: roundLabel(safe.round),
    protoRoundKey: protoRoundKey(safe.year, safe.round),
  };
}

function assertUnderProtoRoundsRoot(relPosix: string): string {
  const posix = toPosixPath(relPosix);
  const parts = posix.split("/");
  if (
    posix.startsWith("/") ||
    parts.includes("..") ||
    parts.includes("") ||
    parts[0] !== PROTO_ROUNDS_ROOT
  ) {
    throw new Error("PROTO_ROUND_PATH_ESCAPE");
  }
  return posix;
}

/** User-facing round folder. Calendar date is not part of this path. */
export function roundDirectoryRelative(year: number, round: number): string {
  const safe = assertSafeProtoRoundCoords(year, round);
  return assertUnderProtoRoundsRoot(
    path.posix.join(PROTO_ROUNDS_ROOT, String(safe.year), roundLabel(safe.round)),
  );
}

export function inboxDirectoryRelative(year: number, round: number): string {
  return assertUnderProtoRoundsRoot(
    path.posix.join(roundDirectoryRelative(year, round), INBOX_DIR_NAME),
  );
}

export function yangEdgeDirectoryRelative(
  year: number,
  round: number,
): string {
  return assertUnderProtoRoundsRoot(
    path.posix.join(roundDirectoryRelative(year, round), YANG_EDGE_DIR_NAME),
  );
}

export function roundConfigRelative(year: number, round: number): string {
  return assertUnderProtoRoundsRoot(
    path.posix.join(
      yangEdgeDirectoryRelative(year, round),
      ROUND_CONFIG_FILE_NAME,
    ),
  );
}

export function intakeManifestRelative(year: number, round: number): string {
  return assertUnderProtoRoundsRoot(
    path.posix.join(
      yangEdgeDirectoryRelative(year, round),
      INTAKE_MANIFEST_FILE_NAME,
    ),
  );
}

export function absFromRelative(cwd: string, relPosix: string): string {
  const posix = assertUnderProtoRoundsRoot(relPosix);
  return path.join(cwd, ...posix.split("/"));
}

export function inboxFileRelativeFromAbs(
  inboxAbs: string,
  fileAbs: string,
): string {
  const fromInbox = toPosixPath(path.relative(inboxAbs, fileAbs));
  if (
    fromInbox.startsWith("..") ||
    path.isAbsolute(fromInbox) ||
    fromInbox.split("/").includes("..")
  ) {
    throw new Error("PROTO_ROUND_PATH_ESCAPE");
  }
  return toPosixPath(path.posix.join(INBOX_DIR_NAME, fromInbox));
}
