import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  emptyReleaseChecklistView,
  parseReleaseChecklistMarkdown,
} from "./parse-release-checklist";
import type { ReleaseChecklistView } from "./types";
import { RELEASE_CHECKLIST_RELATIVE_PATH } from "./types";

/**
 * Read-only load of the Release checklist markdown.
 * Never writes. Never calls Provider / Engine / Prediction.
 */
export async function loadReleaseChecklistV0(
  cwd: string = process.cwd(),
): Promise<ReleaseChecklistView> {
  const sourcePath = RELEASE_CHECKLIST_RELATIVE_PATH;
  const abs = path.join(cwd, ...sourcePath.split("/"));
  try {
    const markdown = await readFile(abs, "utf8");
    return parseReleaseChecklistMarkdown(markdown, sourcePath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return emptyReleaseChecklistView(`CHECKLIST_READ_FAILED: ${msg}`, sourcePath);
  }
}
