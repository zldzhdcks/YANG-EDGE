/**
 * Football V4 Phase 0 player-context persist planner + writer.
 *
 * Phase 0 unattended mission: call plan / persist with executeWrite=false only.
 * Do not invoke executeWrite:true from this mission.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { footballV4PlayerContextSnapshotRel } from "../player-context-foundation-v1/paths";
import type {
  FootballV4PersistPlanV1,
  FootballV4PersistResultV1,
  FootballV4PlayerContextSnapshotV1,
} from "./types";

export function planFootballV4PlayerContextPersist(input: {
  snapshot: FootballV4PlayerContextSnapshotV1;
}): FootballV4PersistPlanV1 {
  return {
    relativePath: footballV4PlayerContextSnapshotRel({
      observedAt: input.snapshot.observedAt,
      providerFixtureId: input.snapshot.providerFixtureId,
      providerTeamId: input.snapshot.providerTeamId,
    }),
    payload: input.snapshot,
    appendOnly: true,
    overwriteForbidden: true,
    writeExecuted: false,
    skippedReason: "EXECUTE_WRITE_NOT_REQUESTED",
  };
}

/**
 * Append-only writer. Default executeWrite=false returns a plan and does not
 * touch the filesystem. executeWrite=true is for attended validation only.
 */
export async function persistFootballV4PlayerContextSnapshot(input: {
  snapshot: FootballV4PlayerContextSnapshotV1;
  repoRoot?: string;
  executeWrite?: boolean;
}): Promise<FootballV4PersistResultV1> {
  const plan = planFootballV4PlayerContextPersist({ snapshot: input.snapshot });
  if (input.executeWrite !== true) {
    return plan;
  }

  const abs = path.join(input.repoRoot ?? process.cwd(), plan.relativePath);
  if (existsSync(abs)) {
    return { ...plan, skippedReason: "OVERWRITE_FORBIDDEN" };
  }

  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(plan.payload, null, 2)}\n`, "utf8");
  return {
    relativePath: plan.relativePath,
    payload: plan.payload,
    appendOnly: true,
    overwriteForbidden: true,
    writeExecuted: true,
  };
}
