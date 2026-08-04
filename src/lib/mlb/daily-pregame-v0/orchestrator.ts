/**
 * MLB Daily Pregame Line v0 — orchestrator.
 * Reuses existing runners; dry-run / --no-provider never mutate or call providers.
 */
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { spawnLocalTsxScript } from "./spawn";
import {
  buildPredictionSnapshotV0,
  loadAndPredictMlbV0,
  snapshotWriteHash,
  configHash,
  sha256,
} from "@/lib/mlb/prediction-v0";
import {
  artifactPaths,
  auditDomesticMarkets,
  auditLineup,
  auditOdds,
  auditSchedule,
  auditStarter,
  auditSummary,
} from "./audit-artifacts";
import {
  evaluateCutoffGate,
  evaluateOddsUsability,
  evaluateStarterUsability,
  stageStatusForUsability,
} from "./pregame-gates";
import type {
  DailyOverallStatus,
  DailyPregameReport,
  DailyStageName,
  DailyStageResult,
  DailyStageStatus,
} from "./types";

export type DailyPregameOptions = {
  dateKst: string;
  dryRun?: boolean;
  noProvider?: boolean;
  json?: boolean;
  gameIds?: string[];
  skipLineup?: boolean;
  observationOnly?: boolean;
  useMarketPrior?: boolean;
  stopAfter?: DailyStageName;
  resumeFrom?: DailyStageName;
  cwd?: string;
  /** Persist prediction snapshot when not dry-run. Default true if unset. */
  writePrediction?: boolean;
  /** ISO timestamp for cutoff checks (defaults to generatedAt). */
  asOf?: string;
  /**
   * Enforce pregame freeze gates (cutoff / odds usable / starter integrity).
   * Defaults to true when writing a real prediction; false for dry-run historical.
   */
  enforcePregameGates?: boolean;
};

export const MLB_DAILY_PREGAME_STAGE_ORDER: DailyStageName[] = [
  "SCHEDULE",
  "STARTER",
  "ODDS",
  "LINEUP",
  "INPUT_AUDIT",
  "PREDICTION_V0",
  "SNAPSHOT_VERIFY",
];

const STAGE_ORDER = MLB_DAILY_PREGAME_STAGE_ORDER;

function stageIndex(name: DailyStageName): number {
  return STAGE_ORDER.indexOf(name);
}

function emptyStage(
  stage: DailyStageName,
  status: DailyStageStatus,
  extra: Partial<DailyStageResult> = {},
): DailyStageResult {
  return {
    stage,
    status,
    inputPaths: [],
    outputPaths: [],
    providerCalls: 0,
    rows: null,
    activeGames: null,
    readyGames: null,
    passGames: null,
    blockedGames: null,
    warnings: [],
    blockers: [],
    durationMs: 0,
    errorCode: null,
    message: null,
    ...extra,
  };
}

function recommendedRunAt(earliestStart: string | null): string | null {
  if (!earliestStart) return null;
  const t = Date.parse(earliestStart);
  if (!Number.isFinite(t)) return null;
  // Suggest T-90 minutes window start
  return new Date(t - 90 * 60 * 1000).toISOString();
}

function verifySnapshotDoc(doc: {
  meta: Record<string, unknown>;
  predictions: Array<Record<string, unknown>>;
}): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const p of doc.predictions) {
    const id = String(p.gameId ?? "");
    const ext = String(p.externalId ?? "");
    const start = String(p.startTimeKst ?? p.commenceTimeUtc ?? "");
    // Doubleheaders may share team-slug gameId; disambiguate by start time.
    const key = `${id}::${ext}::${start}`;
    if (!id) errors.push("MISSING_GAME_ID");
    if (seen.has(key)) errors.push(`DUP_GAME_KEY_${id}`);
    seen.add(key);
    const mps = Array.isArray(p.marketPredictions) ? p.marketPredictions : [];
    const mp = mps[0] as Record<string, unknown> | undefined;
    if (!mp) {
      errors.push(`NO_MARKET_${id}`);
      continue;
    }
    if (mp.marketType !== "MONEYLINE_2WAY") {
      errors.push(`BAD_MARKET_TYPE_${id}`);
    }
    const hp = Number(mp.homeProbability);
    const ap = Number(mp.awayProbability);
    if (!Number.isFinite(hp) || !Number.isFinite(ap)) {
      errors.push(`NON_FINITE_${id}`);
    } else {
      if (Math.abs(hp + ap - 1) > 1e-6) errors.push(`SUM_NE_1_${id}`);
      if (hp < 0.35 - 1e-9 || hp > 0.65 + 1e-9) {
        errors.push(`CLAMP_VIOLATION_${id}`);
      }
    }
    if (p.officialPick != null) errors.push(`OFFICIAL_PICK_SET_${id}`);
  }
  if (Number(doc.meta.officialPickCount ?? 0) !== 0) {
    errors.push("OFFICIAL_PICK_COUNT_NE_0");
  }
  return errors;
}

export async function runMlbDailyPregameV0(
  options: DailyPregameOptions,
): Promise<DailyPregameReport> {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = Boolean(options.dryRun);
  const noProvider = Boolean(options.noProvider) || dryRun;
  const writePrediction =
    (options.writePrediction !== false) && !dryRun;
  const dateKst = options.dateKst;
  const generatedAt = new Date().toISOString();
  const asOfIso = options.asOf ?? generatedAt;
  const enforcePregameGates =
    options.enforcePregameGates ?? writePrediction;
  const useMarketPrior = options.useMarketPrior !== false;
  const stages: DailyStageResult[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  let providerCalls = 0;
  let writesPerformed = 0;
  let scheduleUsable = false;

  const resumeFrom = options.resumeFrom ?? "SCHEDULE";
  const stopAfter = options.stopAfter ?? "SNAPSHOT_VERIFY";
  const startIdx = stageIndex(resumeFrom);
  const stopIdx = stageIndex(stopAfter);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    throw new Error(`Invalid dateKst: ${dateKst}`);
  }
  if (startIdx < 0 || stopIdx < 0 || startIdx > stopIdx) {
    throw new Error("Invalid resume-from / stop-after stage");
  }

  const shouldRun = (stage: DailyStageName) => {
    const i = stageIndex(stage);
    return i >= startIdx && i <= stopIdx;
  };

  // ---- SCHEDULE ----
  let schedule = await auditSchedule(dateKst, cwd);
  if (shouldRun("SCHEDULE")) {
    const t0 = Date.now();
    if (schedule.exists && !schedule.dateKstMatch) {
      stages.push(
        emptyStage("SCHEDULE", "FAILED", {
          outputPaths: [schedule.path],
          blockers: ["SCHEDULE_DATE_MISMATCH"],
          errorCode: "SCHEDULE_DATE_MISMATCH",
          message: "Schedule artifact dateKst does not match CLI --date",
          warnings: schedule.warnings,
          durationMs: Date.now() - t0,
        }),
      );
      blockingIssues.push("SCHEDULE_DATE_MISMATCH");
    } else if (schedule.exists && schedule.dateKstMatch) {
      scheduleUsable = true;
      stages.push(
        emptyStage("SCHEDULE", "ALREADY_COMPLETE", {
          outputPaths: [schedule.path],
          activeGames: schedule.pregameGames,
          rows: schedule.totalGames,
          readyGames: schedule.pregameGames,
          warnings: schedule.warnings,
          durationMs: Date.now() - t0,
          detail: {
            cancelled: schedule.cancelled,
            postponed: schedule.postponed,
            started: schedule.started,
            final: schedule.final,
            earliestStart: schedule.earliestStart,
            latestStart: schedule.latestStart,
          },
        }),
      );
    } else if (noProvider) {
      stages.push(
        emptyStage("SCHEDULE", "BLOCKED", {
          outputPaths: [schedule.path],
          blockers: ["SCHEDULE_ARTIFACT_MISSING"],
          errorCode: "SCHEDULE_ARTIFACT_MISSING",
          message: "Schedule artifact missing; Provider call skipped",
          durationMs: Date.now() - t0,
          detail: { wouldRun: true, runner: "research:mlb-schedule" },
        }),
      );
      blockingIssues.push("SCHEDULE_ARTIFACT_MISSING");
    } else {
      // Real collection
      const code = await spawnLocalTsxScript(
        "scripts/build-mlb-schedule-artifact-v1.ts",
        [dateKst],
      );
      providerCalls += 1;
      writesPerformed += code === 0 ? 1 : 0;
      schedule = await auditSchedule(dateKst, cwd);
      scheduleUsable = schedule.exists && schedule.dateKstMatch;
      stages.push(
        emptyStage(
          "SCHEDULE",
          code === 0 && scheduleUsable ? "SUCCESS" : "FAILED",
          {
            outputPaths: [schedule.path],
            providerCalls: 1,
            activeGames: schedule.pregameGames,
            rows: schedule.totalGames,
            blockers: scheduleUsable
              ? []
              : schedule.exists
                ? ["SCHEDULE_DATE_MISMATCH"]
                : ["SCHEDULE_COLLECTION_FAILED"],
            durationMs: Date.now() - t0,
          },
        ),
      );
      if (!scheduleUsable) {
        blockingIssues.push(
          schedule.exists
            ? "SCHEDULE_DATE_MISMATCH"
            : "SCHEDULE_COLLECTION_FAILED",
        );
      }
    }
  } else {
    scheduleUsable = schedule.exists && schedule.dateKstMatch;
    stages.push(emptyStage("SCHEDULE", "SKIPPED"));
  }

  const scheduleIds = schedule.games
    .filter((g) => {
      const st = g.status.toUpperCase();
      return !st.includes("CANCEL") && !st.includes("POSTPON");
    })
    .map((g) => g.gameId);
  const filterIds = options.gameIds?.length
    ? scheduleIds.filter((id) => options.gameIds!.includes(id))
    : scheduleIds;

  // ---- STARTER ----
  let starter = await auditStarter(dateKst, cwd, filterIds);
  let summaryEarly = await auditSummary(dateKst, cwd);
  let summaryDoc: unknown = null;
  if (summaryEarly.exists) {
    try {
      summaryDoc = JSON.parse(
        await readFile(path.join(cwd, summaryEarly.path), "utf8"),
      ) as unknown;
    } catch {
      summaryDoc = null;
    }
  }
  let starterUsability = evaluateStarterUsability({
    starter,
    scheduleGameCount: filterIds.length,
    dailySummary: summaryDoc,
  });
  if (shouldRun("STARTER")) {
    const t0 = Date.now();
    if (!scheduleUsable) {
      stages.push(
        emptyStage("STARTER", "BLOCKED", {
          blockers: ["SCHEDULE_REQUIRED"],
          durationMs: Date.now() - t0,
        }),
      );
    } else if (starter.exists) {
      const st = stageStatusForUsability(starterUsability.usability);
      const stageStatus: DailyStageStatus =
        st === "WOULD_RUN" ? "PARTIAL" : st;
      stages.push(
        emptyStage("STARTER", stageStatus, {
          outputPaths: [starter.path],
          rows: starter.rows,
          readyGames: Number(starter.detail.bothSidesReady ?? 0),
          activeGames: filterIds.length,
          warnings: [
            ...starter.warnings,
            ...starterUsability.reasonCodes,
          ],
          blockers:
            starterUsability.usability === "INTEGRITY_FAILED" ||
            starterUsability.usability === "ARTIFACT_PRESENT_UNUSABLE"
              ? starterUsability.reasonCodes
              : [],
          durationMs: Date.now() - t0,
          detail: {
            ...starter.detail,
            usability: starterUsability.usability,
            builderExitCode: starterUsability.builderExitCode,
          },
        }),
      );
      warnings.push(...starter.warnings, ...starterUsability.reasonCodes);
      if (starterUsability.usability === "INTEGRITY_FAILED") {
        blockingIssues.push("STARTER_INTEGRITY_FAILED");
      }
    } else if (noProvider) {
      stages.push(
        emptyStage("STARTER", "WOULD_RUN", {
          outputPaths: [starter.path],
          blockers: ["STARTER_ARTIFACT_MISSING"],
          durationMs: Date.now() - t0,
          detail: { wouldRun: true, runner: "research:starter" },
        }),
      );
      warnings.push("STARTER_ARTIFACT_MISSING");
    } else {
      const code = await spawnLocalTsxScript(
        "scripts/run-mlb-starter-accumulation-with-summary-v1.ts",
        [dateKst],
      );
      providerCalls += 1;
      writesPerformed += code === 0 ? 1 : 0;
      starter = await auditStarter(dateKst, cwd, filterIds);
      summaryEarly = await auditSummary(dateKst, cwd);
      if (summaryEarly.exists) {
        try {
          summaryDoc = JSON.parse(
            await readFile(path.join(cwd, summaryEarly.path), "utf8"),
          ) as unknown;
        } catch {
          summaryDoc = null;
        }
      }
      starterUsability = evaluateStarterUsability({
        starter,
        scheduleGameCount: filterIds.length,
        dailySummary: summaryDoc,
      });
      if (code !== 0) {
        blockingIssues.push("STARTER_BUILDER_EXIT_NONZERO");
        starterUsability = {
          ...starterUsability,
          usability: "INTEGRITY_FAILED",
          reasonCodes: [
            ...new Set([
              ...starterUsability.reasonCodes,
              "STARTER_BUILDER_EXIT_NONZERO",
            ]),
          ],
          builderExitCode: code,
        };
      }
      stages.push(
        emptyStage(
          "STARTER",
          code === 0 && starter.exists
            ? stageStatusForUsability(starterUsability.usability) ===
              "ALREADY_COMPLETE"
              ? "SUCCESS"
              : "PARTIAL"
            : "FAILED",
          {
            outputPaths: [starter.path],
            providerCalls: 1,
            rows: starter.rows,
            durationMs: Date.now() - t0,
            detail: { usability: starterUsability.usability, exitCode: code },
            blockers:
              code !== 0 ? ["STARTER_BUILDER_EXIT_NONZERO"] : [],
          },
        ),
      );
    }
  } else {
    stages.push(emptyStage("STARTER", "SKIPPED"));
  }

  // ---- ODDS ----
  let odds = await auditOdds(dateKst, cwd, filterIds);
  let oddsUsability = evaluateOddsUsability(odds, filterIds.length);
  if (shouldRun("ODDS")) {
    const t0 = Date.now();
    if (!scheduleUsable) {
      stages.push(
        emptyStage("ODDS", "BLOCKED", {
          blockers: ["SCHEDULE_REQUIRED"],
          durationMs: Date.now() - t0,
        }),
      );
    } else if (odds.exists) {
      const st = stageStatusForUsability(oddsUsability.usability);
      stages.push(
        emptyStage("ODDS", st === "WOULD_RUN" ? "PARTIAL" : st, {
          outputPaths: [odds.path],
          rows: odds.rows,
          readyGames: Number(odds.detail.moneylineCompleteGames ?? 0),
          activeGames: filterIds.length,
          warnings: [...odds.warnings, ...oddsUsability.reasonCodes],
          blockers:
            oddsUsability.usability === "ARTIFACT_PRESENT_UNUSABLE"
              ? oddsUsability.reasonCodes
              : [],
          durationMs: Date.now() - t0,
          detail: {
            ...odds.detail,
            usability: oddsUsability.usability,
            collectedGames: oddsUsability.collectedGames,
          },
        }),
      );
      warnings.push(...odds.warnings, ...oddsUsability.reasonCodes);
      if (oddsUsability.usability === "ARTIFACT_PRESENT_UNUSABLE") {
        blockingIssues.push("ODDS_MISSING_ALL");
      }
    } else if (noProvider) {
      stages.push(
        emptyStage("ODDS", "WOULD_RUN", {
          outputPaths: [odds.path],
          blockers: ["ODDS_ARTIFACT_MISSING"],
          durationMs: Date.now() - t0,
          detail: {
            wouldRun: true,
            runner: "research:mlb-odds",
            quotaGate: "UNKNOWN — cache/artifact first",
          },
        }),
      );
      warnings.push("ODDS_ARTIFACT_MISSING");
    } else {
      const code = await spawnLocalTsxScript(
        "scripts/build-mlb-odds-history-dataset-v1.ts",
        [dateKst],
      );
      providerCalls += 1;
      writesPerformed += code === 0 ? 1 : 0;
      odds = await auditOdds(dateKst, cwd, filterIds);
      oddsUsability = evaluateOddsUsability(odds, filterIds.length);
      if (oddsUsability.usability === "ARTIFACT_PRESENT_UNUSABLE") {
        blockingIssues.push("ODDS_MISSING_ALL");
      }
      stages.push(
        emptyStage(
          "ODDS",
          odds.exists
            ? oddsUsability.usability === "DATA_COMPLETE"
              ? "SUCCESS"
              : "PARTIAL"
            : "FAILED",
          {
            outputPaths: [odds.path],
            providerCalls: 1,
            rows: odds.rows,
            durationMs: Date.now() - t0,
            detail: { usability: oddsUsability.usability },
            blockers:
              oddsUsability.usability === "ARTIFACT_PRESENT_UNUSABLE"
                ? oddsUsability.reasonCodes
                : [],
          },
        ),
      );
    }
  } else {
    stages.push(emptyStage("ODDS", "SKIPPED"));
  }

  // ---- LINEUP ----
  let lineup = await auditLineup(dateKst, cwd, filterIds);
  if (shouldRun("LINEUP")) {
    const t0 = Date.now();
    if (options.skipLineup) {
      stages.push(
        emptyStage("LINEUP", "SKIPPED", {
          warnings: ["SKIP_LINEUP_FLAG"],
          durationMs: Date.now() - t0,
        }),
      );
    } else if (!scheduleUsable) {
      stages.push(
        emptyStage("LINEUP", "BLOCKED", {
          blockers: ["SCHEDULE_REQUIRED"],
          durationMs: Date.now() - t0,
        }),
      );
    } else if (lineup.exists) {
      stages.push(
        emptyStage("LINEUP", "ALREADY_COMPLETE", {
          outputPaths: [lineup.path],
          rows: lineup.rows,
          readyGames: Number(lineup.detail.confirmedCompleteGames ?? 0),
          activeGames: filterIds.length,
          warnings: lineup.warnings,
          durationMs: Date.now() - t0,
          detail: lineup.detail,
        }),
      );
      warnings.push(...lineup.warnings);
    } else if (noProvider) {
      stages.push(
        emptyStage("LINEUP", "WOULD_RUN", {
          outputPaths: [lineup.path],
          warnings: ["LINEUP_ARTIFACT_MISSING"],
          durationMs: Date.now() - t0,
          detail: { wouldRun: true, runner: "research:mlb-lineup" },
        }),
      );
      warnings.push("LINEUP_ARTIFACT_MISSING");
    } else {
      const code = await spawnLocalTsxScript(
        "scripts/build-mlb-lineup-dataset-v1.ts",
        [dateKst],
      );
      providerCalls += 1;
      writesPerformed += code === 0 ? 1 : 0;
      lineup = await auditLineup(dateKst, cwd, filterIds);
      stages.push(
        emptyStage("LINEUP", lineup.exists ? "SUCCESS" : "PARTIAL", {
          outputPaths: [lineup.path],
          providerCalls: 1,
          rows: lineup.rows,
          durationMs: Date.now() - t0,
        }),
      );
    }
  } else {
    stages.push(emptyStage("LINEUP", "SKIPPED"));
  }

  // ---- INPUT_AUDIT ----
  let summary = await auditSummary(dateKst, cwd);
  const domestic = await auditDomesticMarkets(dateKst, cwd);
  let inputManifest: Record<string, unknown> | null = null;
  const cutoffGate = evaluateCutoffGate({
    schedule,
    asOfIso,
    gameIds: options.gameIds,
  });
  if (shouldRun("INPUT_AUDIT")) {
    const t0 = Date.now();
    const blockers: string[] = [];
    if (!scheduleUsable) blockers.push("SCHEDULE_MISSING");
    if (!summary.exists) blockers.push("DAILY_SUMMARY_MISSING");
    if (!starter.exists) blockers.push("STARTER_MISSING");
    if (!odds.exists) blockers.push("ODDS_MISSING");
    if (oddsUsability.usability === "ARTIFACT_PRESENT_UNUSABLE") {
      blockers.push("ODDS_MISSING_ALL");
    }
    if (starterUsability.usability === "INTEGRITY_FAILED") {
      blockers.push("STARTER_INTEGRITY_FAILED");
    }
    if (enforcePregameGates && cutoffGate.blocked) {
      blockers.push("BLOCKED_AFTER_START");
    } else if (enforcePregameGates && cutoffGate.gamesAfterStart > 0) {
      blockers.push("SOME_GAMES_AFTER_START");
    }
    if (useMarketPrior && oddsUsability.collectedGames === 0 && odds.exists) {
      blockers.push("MARKET_PRIOR_REQUIRES_ODDS");
    }

    // Ensure daily summary for prediction consumer
    if (!summary.exists && !noProvider && scheduleUsable) {
      const code = await spawnLocalTsxScript(
        "scripts/build-mlb-daily-research-v1.ts",
        [dateKst],
      );
      writesPerformed += code === 0 ? 1 : 0;
      summary = await auditSummary(dateKst, cwd);
      if (!summary.exists) blockers.push("DAILY_SUMMARY_REQUIRED_FOR_PREDICTION");
      else {
        const idx = blockers.indexOf("DAILY_SUMMARY_MISSING");
        if (idx >= 0) blockers.splice(idx, 1);
      }
    }

    const missingInputs = [...blockers];
    const manifestBody = {
      schemaVersion: "mlb-daily-input-manifest-v0",
      dateKst,
      scheduleHash: schedule.hash,
      starterHash: starter.hash,
      oddsHash: odds.hash,
      lineupHash: lineup.hash,
      summaryHash: summary.hash,
      configHash: configHash(),
      domesticMarketHash: domestic.hash,
      domesticMoneylineAvailable: domestic.moneylineAvailable,
      domesticTotalsAvailable: domestic.totalsAvailable,
      domesticRunLineAvailable: domestic.runLineAvailable,
      domesticNamespace: domestic.namespace,
      domesticDoesNotReplaceOverseasPrior:
        domestic.doesNotReplaceOverseasPrior,
      eligibleMarkets: ["MONEYLINE_2WAY"] as const,
      notImplementedMarkets: ["TOTALS", "RUN_LINE"] as const,
      gameIds: filterIds,
      cutoffStatus: cutoffGate.blocked
        ? "BLOCKED_AFTER_START"
        : scheduleUsable
          ? "AUDIT_PER_GAME"
          : "UNKNOWN",
      leakageStatus: "GUARDS_ACTIVE",
      identityStatus: schedule.duplicateGameIds.length
        ? "DUPLICATE_IDS"
        : "OK",
      starterUsability: starterUsability.usability,
      oddsUsability: oddsUsability.usability,
      enforcePregameGates,
      asOf: asOfIso,
      missingInputs,
      warnings: [
        ...new Set([
          ...schedule.warnings,
          ...starter.warnings,
          ...odds.warnings,
          ...lineup.warnings,
          ...domestic.warnings,
          ...starterUsability.reasonCodes,
          ...oddsUsability.reasonCodes,
          ...cutoffGate.reasonCodes,
        ]),
      ],
    };
    inputManifest = {
      ...manifestBody,
      inputManifestHash: sha256(manifestBody),
    };

    const inputBlocked =
      blockers.includes("SCHEDULE_MISSING") ||
      blockers.includes("DAILY_SUMMARY_MISSING") ||
      blockers.includes("DAILY_SUMMARY_REQUIRED_FOR_PREDICTION") ||
      blockers.includes("ODDS_MISSING_ALL") ||
      blockers.includes("STARTER_INTEGRITY_FAILED") ||
      blockers.includes("BLOCKED_AFTER_START") ||
      blockers.includes("MARKET_PRIOR_REQUIRES_ODDS");

    stages.push(
      emptyStage("INPUT_AUDIT", inputBlocked ? "BLOCKED" : "READY", {
        inputPaths: [
          schedule.path,
          starter.path,
          odds.path,
          lineup.path,
          summary.path,
          domestic.path,
        ].filter(Boolean),
        blockers,
        warnings: manifestBody.warnings,
        durationMs: Date.now() - t0,
        detail: inputManifest,
        readyGames: filterIds.length,
      }),
    );
    if (
      blockers.includes("DAILY_SUMMARY_MISSING") ||
      blockers.includes("DAILY_SUMMARY_REQUIRED_FOR_PREDICTION")
    ) {
      blockingIssues.push("DAILY_SUMMARY_MISSING");
    }
    if (blockers.includes("ODDS_MISSING_ALL") || blockers.includes("MARKET_PRIOR_REQUIRES_ODDS")) {
      blockingIssues.push("ODDS_MISSING_ALL");
    }
    if (blockers.includes("STARTER_INTEGRITY_FAILED")) {
      blockingIssues.push("STARTER_INTEGRITY_FAILED");
    }
    if (blockers.includes("BLOCKED_AFTER_START")) {
      blockingIssues.push("BLOCKED_AFTER_START");
    }
    if (inputBlocked) blockingIssues.push("INPUT_AUDIT_BLOCKED");
  } else {
    stages.push(emptyStage("INPUT_AUDIT", "SKIPPED"));
  }

  // ---- PREDICTION_V0 ----
  let predictionDetail: Record<string, unknown> | null = null;
  let snapshotDoc: ReturnType<typeof buildPredictionSnapshotV0> | null = null;
  if (shouldRun("PREDICTION_V0")) {
    const t0 = Date.now();
    const summaryNow = await auditSummary(dateKst, cwd);
    const freezeBlockers: string[] = [];
    if (!scheduleUsable) freezeBlockers.push("SCHEDULE_REQUIRED");
    if (!summaryNow.exists) freezeBlockers.push("DAILY_SUMMARY_MISSING");
    if (enforcePregameGates && cutoffGate.blocked) {
      freezeBlockers.push("BLOCKED_AFTER_START");
    }
    if (
      enforcePregameGates &&
      useMarketPrior &&
      oddsUsability.usability === "ARTIFACT_PRESENT_UNUSABLE"
    ) {
      freezeBlockers.push("BLOCKED_ODDS_MISSING");
    }
    if (
      enforcePregameGates &&
      starterUsability.usability === "INTEGRITY_FAILED"
    ) {
      freezeBlockers.push("BLOCKED_STARTER_INTEGRITY");
    }

    if (freezeBlockers.length) {
      for (const b of freezeBlockers) blockingIssues.push(b);
      stages.push(
        emptyStage("PREDICTION_V0", "BLOCKED", {
          blockers: freezeBlockers,
          errorCode: freezeBlockers[0],
          message:
            "Pregame freeze blocked by cutoff/odds/starter integrity gates",
          durationMs: Date.now() - t0,
          detail: {
            enforcePregameGates,
            cutoffGate,
            oddsUsability,
            starterUsability,
            useMarketPrior,
          },
        }),
      );
    } else if (!scheduleUsable) {
      stages.push(
        emptyStage("PREDICTION_V0", "BLOCKED", {
          blockers: ["SCHEDULE_REQUIRED"],
          durationMs: Date.now() - t0,
        }),
      );
    } else if (!summaryNow.exists) {
      stages.push(
        emptyStage("PREDICTION_V0", "BLOCKED", {
          blockers: ["DAILY_SUMMARY_MISSING"],
          errorCode: "DAILY_SUMMARY_MISSING",
          message:
            "Prediction v0 requires daily research summary. Run research:mlb-daily first.",
          durationMs: Date.now() - t0,
          detail: {
            wouldRun: true,
            runner: "predict:mlb-v0",
            nextAction: "RUN_DAILY_SUMMARY_THEN_PREDICT",
          },
        }),
      );
      blockingIssues.push("DAILY_SUMMARY_MISSING");
    } else {
      try {
        const load = await loadAndPredictMlbV0({
          dateKst,
          cwd,
          gameIds: options.gameIds,
          observationOnly: options.observationOnly,
          useMarketPrior,
        });
        if (load.kind === "blocked") {
          stages.push(
            emptyStage("PREDICTION_V0", "BLOCKED", {
              blockers: [load.reason],
              errorCode: load.reason,
              message: load.message,
              warnings: load.warnings,
              durationMs: Date.now() - t0,
            }),
          );
          blockingIssues.push(load.reason);
        } else {
          snapshotDoc = buildPredictionSnapshotV0({
            load,
            generatedAt,
            dryRun,
            observationOnly: Boolean(options.observationOnly),
            useMarketPrior,
          });
          predictionDetail = {
            predictionHashSha256: snapshotDoc.meta.predictionHashSha256,
            configHash: snapshotDoc.meta.configHash,
            inputManifestHash: snapshotDoc.meta.inputManifestHash,
            eligibleCount: snapshotDoc.meta.eligibleCount,
            passCount: snapshotDoc.meta.passCount,
            blockedCount: snapshotDoc.meta.blockedCount,
            researchBaselineCount: snapshotDoc.meta.researchBaselineCount,
            officialPickCount: snapshotDoc.meta.officialPickCount,
            totalGames: snapshotDoc.summary.totalGames,
            writeHash: snapshotWriteHash(snapshotDoc),
          };

          const predPath = artifactPaths(dateKst).prediction;
          if (writePrediction) {
            // Idempotent: skip if same hashes
            let skip = false;
            try {
              const prev = JSON.parse(
                await readFile(path.join(cwd, predPath), "utf8"),
              ) as { meta?: Record<string, unknown> };
              if (
                prev.meta?.predictionHashSha256 ===
                  snapshotDoc.meta.predictionHashSha256 &&
                prev.meta?.configHash === snapshotDoc.meta.configHash &&
                prev.meta?.inputManifestHash ===
                  snapshotDoc.meta.inputManifestHash
              ) {
                skip = true;
              } else {
                // revision preserve
                const rev = predPath.replace(
                  ".json",
                  `.rev-${generatedAt.replace(/[:.]/g, "-")}.json`,
                );
                await copyFile(path.join(cwd, predPath), path.join(cwd, rev));
              }
            } catch {
              /* no previous */
            }
            if (!skip) {
              await mkdir(path.dirname(path.join(cwd, predPath)), {
                recursive: true,
              });
              await writeFile(
                path.join(cwd, predPath),
                `${JSON.stringify(snapshotDoc, null, 2)}\n`,
                "utf8",
              );
              writesPerformed += 1;
            }
            stages.push(
              emptyStage("PREDICTION_V0", skip ? "ALREADY_COMPLETE" : "SUCCESS", {
                outputPaths: [predPath],
                passGames: snapshotDoc.meta.passCount,
                blockedGames: snapshotDoc.meta.blockedCount,
                readyGames: snapshotDoc.meta.eligibleCount,
                activeGames: snapshotDoc.summary.totalGames,
                durationMs: Date.now() - t0,
                detail: predictionDetail,
              }),
            );
          } else {
            stages.push(
              emptyStage("PREDICTION_V0", dryRun ? "WOULD_RUN" : "SUCCESS", {
                outputPaths: [predPath],
                passGames: snapshotDoc.meta.passCount,
                blockedGames: snapshotDoc.meta.blockedCount,
                readyGames: snapshotDoc.meta.eligibleCount,
                activeGames: snapshotDoc.summary.totalGames,
                durationMs: Date.now() - t0,
                detail: {
                  ...predictionDetail,
                  written: false,
                  dryRun,
                },
              }),
            );
          }
        }
      } catch (e) {
        stages.push(
          emptyStage("PREDICTION_V0", "FAILED", {
            errorCode: "PREDICTION_EXCEPTION",
            message: e instanceof Error ? e.message : String(e),
            durationMs: Date.now() - t0,
          }),
        );
        blockingIssues.push("PREDICTION_EXCEPTION");
      }
    }
  } else {
    stages.push(emptyStage("PREDICTION_V0", "SKIPPED"));
  }

  // ---- SNAPSHOT_VERIFY ----
  if (shouldRun("SNAPSHOT_VERIFY")) {
    const t0 = Date.now();
    if (!snapshotDoc) {
      stages.push(
        emptyStage("SNAPSHOT_VERIFY", "SKIPPED", {
          warnings: ["NO_SNAPSHOT_TO_VERIFY"],
          durationMs: Date.now() - t0,
        }),
      );
    } else {
      const errs = verifySnapshotDoc({
        meta: snapshotDoc.meta as unknown as Record<string, unknown>,
        predictions: snapshotDoc.predictions,
      });
      // Determinism: same predictedAt ⇒ same prediction hash
      const fixedPredictedAt =
        (snapshotDoc.predictions[0]?.predictedAt as string | undefined) ??
        generatedAt;
      const load2 = await loadAndPredictMlbV0({
        dateKst,
        cwd,
        gameIds: options.gameIds,
        observationOnly: options.observationOnly,
        useMarketPrior: options.useMarketPrior !== false,
        predictedAtOverride: fixedPredictedAt,
      });
      if (load2.kind === "ready") {
        const snap2 = buildPredictionSnapshotV0({
          load: load2,
          generatedAt: "1970-01-01T00:00:00.000Z",
          dryRun: true,
          observationOnly: Boolean(options.observationOnly),
          useMarketPrior: options.useMarketPrior !== false,
        });
        if (
          snap2.meta.predictionHashSha256 !==
          snapshotDoc.meta.predictionHashSha256
        ) {
          errs.push("PREDICTION_HASH_NOT_REPRODUCIBLE");
        }
        if (
          snap2.meta.inputManifestHash !== snapshotDoc.meta.inputManifestHash
        ) {
          errs.push("INPUT_MANIFEST_HASH_MISMATCH");
        }
      } else {
        errs.push("DETERMINISM_RELOAD_BLOCKED");
      }
      // If verify fails, do not count a prior write as durable for this run
      if (errs.length && writePrediction && writesPerformed > 0) {
        warnings.push("SNAPSHOT_VERIFY_FAILED_AFTER_WRITE");
      }
      stages.push(
        emptyStage("SNAPSHOT_VERIFY", errs.length ? "FAILED" : "SUCCESS", {
          blockers: errs,
          durationMs: Date.now() - t0,
          detail: {
            officialPickCount: snapshotDoc.meta.officialPickCount,
            predictionHashSha256: snapshotDoc.meta.predictionHashSha256,
            inputManifestHash: snapshotDoc.meta.inputManifestHash,
          },
        }),
      );
      if (errs.length) blockingIssues.push("SNAPSHOT_VERIFY_FAILED");
    }
  } else {
    stages.push(emptyStage("SNAPSHOT_VERIFY", "SKIPPED"));
  }

  const summaryFinal = await auditSummary(dateKst, cwd);

  // Overall
  let overall: DailyOverallStatus = "PARTIAL_READY";
  let nextAction: string | null = null;
  if (blockingIssues.includes("SCHEDULE_DATE_MISMATCH")) {
    overall = "FAILED";
    nextAction = "FIX_SCHEDULE_DATE_MISMATCH";
  } else if (!scheduleUsable) {
    overall = "BLOCKED_MISSING_SCHEDULE";
    nextAction = "RUN_SCHEDULE_COLLECTION";
  } else if (blockingIssues.includes("DAILY_SUMMARY_MISSING")) {
    overall = "BLOCKED_MISSING_SUMMARY";
    nextAction = "RUN_DAILY_SUMMARY";
  } else if (blockingIssues.includes("BLOCKED_AFTER_START")) {
    overall = "BLOCKED_AFTER_START";
    nextAction = "WAIT_NEXT_SLATE_BEFORE_COMMENCE";
  } else if (
    blockingIssues.includes("ODDS_MISSING_ALL") ||
    blockingIssues.includes("BLOCKED_ODDS_MISSING")
  ) {
    overall = "BLOCKED_ODDS_MISSING";
    nextAction = "COLLECT_OVERSEAS_ODDS_BEFORE_FREEZE";
  } else if (
    blockingIssues.includes("STARTER_INTEGRITY_FAILED") ||
    blockingIssues.includes("BLOCKED_STARTER_INTEGRITY") ||
    blockingIssues.includes("STARTER_BUILDER_EXIT_NONZERO")
  ) {
    overall = "BLOCKED_STARTER_INTEGRITY";
    nextAction = "FIX_STARTER_HASH_OR_RECOLLECT_PREGAME";
  } else if (blockingIssues.includes("INPUT_AUDIT_BLOCKED")) {
    overall = "BLOCKED_INPUT_AUDIT";
    nextAction = "RESOLVE_INPUT_AUDIT_BLOCKERS";
  } else if (blockingIssues.includes("SNAPSHOT_VERIFY_FAILED")) {
    overall = "FAILED";
    nextAction = "FIX_SNAPSHOT_VERIFY";
  } else if (
    scheduleUsable &&
    starter.exists &&
    odds.exists &&
    summaryFinal.exists &&
    oddsUsability.usability !== "ARTIFACT_PRESENT_UNUSABLE" &&
    starterUsability.usability !== "INTEGRITY_FAILED" &&
    oddsUsability.collectedGames > 0
  ) {
    overall = "READY_FOR_PREGAME_RUN";
    nextAction = dryRun
      ? "APPROVE_REAL_PREGAME_RUN"
      : "AWAIT_POSTGAME_RESULT_GRADE";
  } else if (
    scheduleUsable &&
    (oddsUsability.usability === "DATA_PARTIAL" ||
      starterUsability.usability === "DATA_PARTIAL")
  ) {
    overall = "PARTIAL_OBSERVATION_ONLY";
    nextAction = "COMPLETE_PARTIAL_INPUTS_OR_OBSERVE_ONLY";
  } else if (noProvider && (!starter.exists || !odds.exists)) {
    overall = "WOULD_COLLECT";
    nextAction = "RUN_WITH_PROVIDER_AFTER_APPROVAL";
  }

  const uniqueWarnings = [...new Set(warnings)];
  const uniqueBlockers = [...new Set(blockingIssues)];

  return {
    schemaVersion: "mlb-daily-pregame-line-v0",
    dateKst,
    overall,
    dryRun,
    noProvider,
    generatedAt,
    stages,
    schedule: schedule.exists
      ? {
          totalGames: schedule.totalGames,
          pregameGames: schedule.pregameGames,
          cancelled: schedule.cancelled,
          postponed: schedule.postponed,
          started: schedule.started,
          final: schedule.final,
          path: schedule.path,
          hash: schedule.hash,
        }
      : null,
    starter: starter.exists
      ? {
          path: starter.path,
          hash: starter.hash,
          ...starter.detail,
          rows: starter.rows,
        }
      : null,
    odds: odds.exists
      ? {
          path: odds.path,
          hash: odds.hash,
          ...odds.detail,
          rows: odds.rows,
        }
      : null,
    lineup: lineup.exists
      ? {
          path: lineup.path,
          hash: lineup.hash,
          ...lineup.detail,
          rows: lineup.rows,
        }
      : null,
    domestic: domestic.exists
      ? {
          path: domestic.path,
          hash: domestic.hash,
          mappedGames: domestic.mappedGames,
          moneylineAvailable: domestic.moneylineAvailable,
          totalsAvailable: domestic.totalsAvailable,
          runLineAvailable: domestic.runLineAvailable,
          unresolvedRows: domestic.unresolvedRows,
          namespace: domestic.namespace,
          doesNotReplaceOverseasPrior: domestic.doesNotReplaceOverseasPrior,
        }
      : null,
    prediction: predictionDetail,
    earliestStart: schedule.earliestStart,
    latestStart: schedule.latestStart,
    recommendedNextRunAt: recommendedRunAt(schedule.earliestStart),
    providerQuota: {
      remaining: null,
      status: "UNKNOWN",
      note: noProvider
        ? "no-provider/dry-run — quota not queried"
        : "Query Odds API remaining headers on real odds stage",
    },
    blockingIssues: uniqueBlockers,
    warnings: uniqueWarnings,
    providerCalls,
    writesPerformed,
    nextAction,
  };
}
