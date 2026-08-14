import { readFile } from "node:fs/promises";
import path from "node:path";
import { footballScheduleV1Rel } from "../core/paths";
import type { FootballScheduleArtifactV1 } from "../core/types";
import { parseFootballScheduleArtifact } from "../odds-1x2-v1/load-schedule";

export async function loadFootballScheduleArtifactForOfficialResult(input: {
  dateKst: string;
  rootDir?: string;
}): Promise<{ document: FootballScheduleArtifactV1; rel: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("FOOTBALL_OFFICIAL_RESULT_DATE_KST_INVALID");
  }
  const root = input.rootDir ?? process.cwd();
  const rel = footballScheduleV1Rel(input.dateKst);
  const abs = path.join(root, rel);
  let text: string;
  try {
    text = await readFile(abs, "utf8");
  } catch {
    throw new Error(`FOOTBALL_OFFICIAL_RESULT_SCHEDULE_MISSING: ${rel}`);
  }
  const document = parseFootballScheduleArtifact(JSON.parse(text));
  if (document.meta.dateKst !== input.dateKst) {
    throw new Error(
      `FOOTBALL_OFFICIAL_RESULT_SCHEDULE_DATE_MISMATCH: file=${document.meta.dateKst} arg=${input.dateKst}`,
    );
  }
  return { document, rel };
}
