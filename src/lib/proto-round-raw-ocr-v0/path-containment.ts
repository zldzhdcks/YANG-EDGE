import path from "node:path";

export class ManifestPathEscapeError extends Error {
  readonly relativePath: string;
  constructor(relativePath: string) {
    super("MANIFEST_PATH_ESCAPE");
    this.name = "ManifestPathEscapeError";
    this.relativePath = relativePath;
  }
}

/**
 * Resolve a manifest relativePath strictly inside roundAbs.
 * Rejects absolute paths, traversal, empty segments, and .yang-edge.
 */
export function resolveContainedCanonicalImageAbs(
  roundAbs: string,
  relativePath: string,
): string {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new ManifestPathEscapeError(String(relativePath));
  }
  if (relativePath.includes("\0")) {
    throw new ManifestPathEscapeError(relativePath);
  }
  if (
    path.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    path.posix.isAbsolute(relativePath)
  ) {
    throw new ManifestPathEscapeError(relativePath);
  }

  const segments = relativePath.replaceAll("\\", "/").split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (seg) =>
        seg === "" ||
        seg === ".." ||
        seg === ".yang-edge" ||
        seg.includes(":"),
    )
  ) {
    throw new ManifestPathEscapeError(relativePath);
  }

  const roundResolved = path.resolve(roundAbs);
  const candidateAbs = path.resolve(roundResolved, ...segments);
  const rel = path.relative(roundResolved, candidateAbs);
  const relPosix = rel.replaceAll("\\", "/");
  if (
    rel === "" ||
    relPosix.startsWith("..") ||
    path.isAbsolute(rel) ||
    path.win32.isAbsolute(rel) ||
    relPosix.split("/").includes("..") ||
    relPosix.split("/").includes(".yang-edge")
  ) {
    throw new ManifestPathEscapeError(relativePath);
  }
  return candidateAbs;
}

export const MANIFEST_PATH_ESCAPE_ALLOWED = false as const;
