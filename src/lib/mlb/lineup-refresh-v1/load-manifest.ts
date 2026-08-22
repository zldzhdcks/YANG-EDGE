import { readFile } from "node:fs/promises";
import { mlbLineupRefreshManifestAbs } from "./paths";
import type { LineupRefreshManifestV1 } from "./types";

export async function loadLineupRefreshManifest(input: {
  dateKst: string;
  cwd?: string;
}): Promise<LineupRefreshManifestV1 | null> {
  try {
    const raw = await readFile(
      mlbLineupRefreshManifestAbs(input.dateKst, input.cwd),
      "utf8",
    );
    return JSON.parse(raw) as LineupRefreshManifestV1;
  } catch {
    return null;
  }
}
