import path from "node:path";
import type { ProtoRoundIdentity } from "./types";

/** Active user-facing operator root. Sibling of the git repo, not inside it. */
export const OPERATOR_ROOT_NAME = "YANG-EDGE-INBOX" as const;

/**
 * Legacy intake root from proto-round screenshot intake v1 first layout.
 * Do not scan, migrate, or delete. No INBOX child is used for the active contract.
 */
export const LEGACY_PROTO_ROUNDS_ROOT = "PROTO_ROUNDS";
export const LEGACY_INBOX_DIR_NAME = "INBOX";

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

/**
 * Resolve YANG-EDGE-INBOX as a sibling of the git repo directory.
 * Does not hardcode a username or drive letter.
 *
 * repo:    <workspaceParent>/<repoDir>
 * inbox:   <workspaceParent>/YANG-EDGE-INBOX
 */
export function resolveOperatorRoot(opts?: {
  repoRoot?: string;
  operatorRootAbs?: string;
}): string {
  if (opts?.operatorRootAbs) {
    const abs = path.resolve(opts.operatorRootAbs);
    if (path.basename(abs) !== OPERATOR_ROOT_NAME) {
      throw new Error("INVALID_OPERATOR_ROOT_NAME");
    }
    return abs;
  }
  const repoRoot = path.resolve(opts?.repoRoot ?? process.cwd());
  return path.resolve(repoRoot, "..", OPERATOR_ROOT_NAME);
}

function assertUnderOperatorRoot(relPosix: string): string {
  const posix = toPosixPath(relPosix);
  const parts = posix.split("/");
  if (
    posix.startsWith("/") ||
    parts.includes("..") ||
    parts.includes("") ||
    parts[0] !== OPERATOR_ROOT_NAME
  ) {
    throw new Error("PROTO_ROUND_PATH_ESCAPE");
  }
  return posix;
}

/** User-facing round folder. No INBOX child. No calendar-date folder. */
export function roundDirectoryRelative(year: number, round: number): string {
  const safe = assertSafeProtoRoundCoords(year, round);
  return assertUnderOperatorRoot(
    path.posix.join(
      OPERATOR_ROOT_NAME,
      String(safe.year),
      roundLabel(safe.round),
    ),
  );
}

/** Screenshots live directly in the round folder. */
export function screenshotDirectoryRelative(
  year: number,
  round: number,
): string {
  return roundDirectoryRelative(year, round);
}

export function yangEdgeDirectoryRelative(
  year: number,
  round: number,
): string {
  return assertUnderOperatorRoot(
    path.posix.join(roundDirectoryRelative(year, round), YANG_EDGE_DIR_NAME),
  );
}

export function roundConfigRelative(year: number, round: number): string {
  return assertUnderOperatorRoot(
    path.posix.join(
      yangEdgeDirectoryRelative(year, round),
      ROUND_CONFIG_FILE_NAME,
    ),
  );
}

export function intakeManifestRelative(year: number, round: number): string {
  return assertUnderOperatorRoot(
    path.posix.join(
      yangEdgeDirectoryRelative(year, round),
      INTAKE_MANIFEST_FILE_NAME,
    ),
  );
}

export function absFromOperatorRelative(
  operatorRootAbs: string,
  relPosix: string,
): string {
  const posix = assertUnderOperatorRoot(relPosix);
  const parts = posix.split("/");
  return path.join(operatorRootAbs, ...parts.slice(1));
}

export function roundFileRelativeFromAbs(
  roundAbs: string,
  fileAbs: string,
): string {
  const fromRound = toPosixPath(path.relative(roundAbs, fileAbs));
  if (
    fromRound.startsWith("..") ||
    path.isAbsolute(fromRound) ||
    fromRound.split("/").includes("..") ||
    fromRound.split("/").includes(".yang-edge")
  ) {
    throw new Error("PROTO_ROUND_PATH_ESCAPE");
  }
  return fromRound;
}
