/**
 * Football Prediction Input Snapshot v0.
 * Consumes Schedule + Odds research artifacts. Never calls a Provider.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { footballScheduleV1Rel } from "../core/paths";
import { isOddsIsoInstant } from "../odds-1x2-v1/instant";
import { parseFootball1x2OddsJsonText } from "../odds-1x2-v1/load-odds-artifact";
import { parseFootballScheduleArtifact } from "../odds-1x2-v1/load-schedule";
import { football1x2OddsV1Rel } from "../odds-1x2-v1/paths";
import type { Football1x2OddsArtifactV1 } from "../odds-1x2-v1/types";
import type { FootballScheduleArtifactV1 } from "../core/types";
import { computeFootballPredictionSnapshotHash } from "./hash";
import { footballPredictionSnapshotV0Rel } from "./paths";
import { selectFrozenOddsObservation } from "./select";
import {
  FOOTBALL_PREDICTION_SNAPSHOT_V0_BUILDER,
  FOOTBALL_PREDICTION_SNAPSHOT_V0_SCHEMA,
  FOOTBALL_SNAPSHOT_SELECTION_POLICY,
  type FootballPredictionSnapshotV0,
} from "./types";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export function assembleFootballPredictionSnapshotV0(input: {
  schedule: FootballScheduleArtifactV1;
  odds: Football1x2OddsArtifactV1;
  freezeAt: string;
  generatedAt: string;
}): FootballPredictionSnapshotV0 {
  if (!isOddsIsoInstant(input.freezeAt)) {
    throw new Error("FOOTBALL_SNAPSHOT_FREEZE_AT_INVALID");
  }
  if (!isOddsIsoInstant(input.generatedAt)) {
    throw new Error("FOOTBALL_SNAPSHOT_GENERATED_AT_INVALID");
  }
  if (
    input.odds.meta.sourceScheduleArtifactHash !==
    input.schedule.meta.artifactHash
  ) {
    throw new Error(
      "SCHEDULE_HASH_CHANGED_VS_EXISTING_ODDS: snapshot refuses mixed generations",
    );
  }
  if (input.schedule.meta.dateKst !== input.odds.meta.dateKst) {
    throw new Error(
      `SNAPSHOT_DATE_MISMATCH: schedule=${input.schedule.meta.dateKst} odds=${input.odds.meta.dateKst}`,
    );
  }

  const matches = input.schedule.rows
    .slice()
    .sort((a, b) => a.matchId.localeCompare(b.matchId))
    .map((row) =>
      selectFrozenOddsObservation({
        row,
        observations: input.odds.observations,
        freezeAt: input.freezeAt,
        scheduleArtifactHash: input.schedule.meta.artifactHash,
      }),
    );

  const eligibleGames = input.schedule.rows.filter(
    (r) => r.predictionEligibility === "ELIGIBLE_FORMAT",
  ).length;

  const withoutHash: Omit<FootballPredictionSnapshotV0, "meta"> & {
    meta: Omit<FootballPredictionSnapshotV0["meta"], "snapshotHash">;
  } = {
    meta: {
      schemaVersion: FOOTBALL_PREDICTION_SNAPSHOT_V0_SCHEMA,
      builderVersion: FOOTBALL_PREDICTION_SNAPSHOT_V0_BUILDER,
      dateKst: input.schedule.meta.dateKst,
      generatedAt: input.generatedAt,
      freezeAt: input.freezeAt,
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      prediction: "NONE",
      engine: "NONE",
      selectionPolicy: FOOTBALL_SNAPSHOT_SELECTION_POLICY,
      sourceScheduleRel: footballScheduleV1Rel(input.schedule.meta.dateKst),
      sourceScheduleArtifactHashAtFreeze: input.schedule.meta.artifactHash,
      sourceOddsRel: football1x2OddsV1Rel(input.odds.meta.dateKst),
      sourceOddsArtifactHashAtFreeze: input.odds.meta.artifactHash,
      scheduleGames: input.schedule.rows.length,
      eligibleGames,
      frozenGames: matches.filter((m) => m.snapshotStatus === "FROZEN").length,
      noUsableOddsGames: matches.filter(
        (m) => m.snapshotStatus === "NO_USABLE_ODDS_BEFORE_FREEZE",
      ).length,
      notEligibleGames: matches.filter(
        (m) => m.snapshotStatus === "NOT_ELIGIBLE_FORMAT",
      ).length,
      blockedGames: matches.filter(
        (m) =>
          m.snapshotStatus === "COMPETITION_BLOCKED" ||
          m.snapshotStatus === "IDENTITY_BLOCKED",
      ).length,
      unknownEligibilityGames: matches.filter(
        (m) => m.snapshotStatus === "UNKNOWN_ELIGIBILITY",
      ).length,
      missedFreezeWindowGames: matches.filter(
        (m) => m.snapshotStatus === "MISSED_SNAPSHOT_FREEZE_WINDOW",
      ).length,
    },
    matches,
  };

  return {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      snapshotHash: computeFootballPredictionSnapshotHash(withoutHash),
    },
  };
}

export async function buildFootballPredictionSnapshotV0(input: {
  dateKst: string;
  freezeAt: string;
  generatedAt: string;
  dryRun: boolean;
  rootDir?: string;
}): Promise<{
  document: FootballPredictionSnapshotV0;
  rel: string;
  wrote: boolean;
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("SNAPSHOT_DATE_KST_INVALID");
  }
  if (!isOddsIsoInstant(input.freezeAt)) {
    throw new Error("FOOTBALL_SNAPSHOT_FREEZE_AT_INVALID");
  }
  if (!isOddsIsoInstant(input.generatedAt)) {
    throw new Error("FOOTBALL_SNAPSHOT_GENERATED_AT_INVALID");
  }

  const root = input.rootDir ?? process.cwd();
  const scheduleRel = footballScheduleV1Rel(input.dateKst);
  const oddsRel = football1x2OddsV1Rel(input.dateKst);
  const snapshotRel = footballPredictionSnapshotV0Rel(input.dateKst);
  const schedulePath = path.join(root, scheduleRel);
  const oddsPath = path.join(root, oddsRel);
  const snapshotPath = path.join(root, snapshotRel);

  let scheduleText: string;
  try {
    scheduleText = await readFile(schedulePath, "utf8");
  } catch {
    throw new Error(`SCHEDULE_ARTIFACT_MISSING: ${scheduleRel}`);
  }
  let scheduleParsed: unknown;
  try {
    scheduleParsed = JSON.parse(scheduleText);
  } catch {
    throw new Error(`SCHEDULE_JSON_INVALID: ${scheduleRel}`);
  }
  const schedule = parseFootballScheduleArtifact(scheduleParsed);

  let oddsText: string;
  try {
    oddsText = await readFile(oddsPath, "utf8");
  } catch {
    throw new Error(`ODDS_ARTIFACT_MISSING: ${oddsRel}`);
  }
  const odds = parseFootball1x2OddsJsonText(oddsText);

  if (schedule.meta.dateKst !== input.dateKst) {
    throw new Error(
      `SCHEDULE_DATE_MISMATCH: file=${schedule.meta.dateKst} arg=${input.dateKst}`,
    );
  }

  if (existsSync(snapshotPath)) {
    throw new Error(
      `FOOTBALL_PREDICTION_SNAPSHOT_ALREADY_EXISTS: ${snapshotRel}`,
    );
  }

  const document = assembleFootballPredictionSnapshotV0({
    schedule,
    odds,
    freezeAt: input.freezeAt,
    generatedAt: input.generatedAt,
  });

  const eligibleKickoffs = schedule.rows
    .filter((r) => r.predictionEligibility === "ELIGIBLE_FORMAT")
    .map((r) => r.kickoffTimeUtc)
    .filter((k): k is string => k != null);
  const freezeMs = Date.parse(input.freezeAt);
  const allEligiblePastKickoff =
    eligibleKickoffs.length > 0 &&
    eligibleKickoffs.every((k) => freezeMs >= Date.parse(k));
  if (allEligiblePastKickoff && document.meta.frozenGames === 0) {
    throw new Error("MISSED_SNAPSHOT_FREEZE_WINDOW");
  }

  let wrote = false;
  if (!input.dryRun) {
    await writeJsonAtomic(snapshotPath, document);
    wrote = true;
  }

  return { document, rel: snapshotRel, wrote };
}
