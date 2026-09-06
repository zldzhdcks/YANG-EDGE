import path from "node:path";
import { sha256FileBytes } from "../proto-round-screenshot-intake-v1/hash";
import { GroundTruthError } from "./error";
import type { ScreenshotBytesProbe } from "./types";
import { stat } from "node:fs/promises";

function absFromRoundRelative(roundAbs: string, relativePath: string): string {
  const posix = relativePath.replaceAll("\\", "/");
  if (
    posix.startsWith("/") ||
    posix.split("/").includes("..") ||
    posix.split("/").includes("")
  ) {
    throw new GroundTruthError("PROTO_ROUND_PATH_ESCAPE");
  }
  return path.join(roundAbs, ...posix.split("/"));
}

export function createScreenshotBytesProbe(roundAbs: string): ScreenshotBytesProbe {
  return {
    async fileExists(roundRelativePath: string) {
      const abs = absFromRoundRelative(roundAbs, roundRelativePath);
      try {
        await stat(abs);
        return true;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return false;
        throw err;
      }
    },
    async fileSha256(roundRelativePath: string) {
      return sha256FileBytes(absFromRoundRelative(roundAbs, roundRelativePath));
    },
  };
}
