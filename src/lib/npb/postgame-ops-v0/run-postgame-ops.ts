/**
 * NPB Postgame Ops One-Command v0
 * Official Result → join → Market Baseline → Lifecycle.
 * Never mutates Pregame Evidence Snapshot. No prediction grades.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  assessNpbDailyEvidenceDay,
  loadNpbDailyOpsView,
  NPB_PREGAME_EVIDENCE_MISSING,
} from "@/lib/npb/daily-evidence-continuity-v0";
import {
  buildNpbOfficialResultsV0,
  collectedOfficialForDate,
  loadNpbOfficialResultsV0,
} from "@/lib/npb/official-result-intake-v0";
import { loadNpbPregameEvidenceSnapshot } from "@/lib/npb/pregame-evidence-snapshot-v0";
import { npbPregameEvidenceSnapshotRel } from "@/lib/npb/official-result-intake-v0/paths";
import { formatNpbPostgameOpsOperatorSummary } from "./operator-summary";
import {
  NPB_POSTGAME_OPS_SCHEMA,
  type NpbPostgameImmutableAudit,
  type NpbPostgameOpsFailure,
  type NpbPostgameOpsReport,
  type NpbPostgameOpsStageName,
} from "./types";

export type NpbPostgameOpsOptions = {
  dateKst: string;
  cwd?: string;
  asOf?: string;
  dryRun?: boolean;
  assessOnly?: boolean;
  /** Alias: no result writes. */
  readOnly?: boolean;
};

function sha256File(abs: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(abs)).digest("hex");
  } catch {
    return null;
  }
}

function mtimeMs(abs: string): number | null {
  try {
    return statSync(abs).mtimeMs;
  } catch {
    return null;
  }
}

function readHashField(abs: string): string | null {
  try {
    const doc = JSON.parse(readFileSync(abs, "utf8")) as {
      predictionHashSha256?: string;
    };
    return doc.predictionHashSha256 ?? null;
  } catch {
    return null;
  }
}

function beginImmutableAudit(input: {
  dateKst: string;
  cwd: string;
}): {
  before: NpbPostgameImmutableAudit;
  finish: () => NpbPostgameImmutableAudit;
} {
  const predictionRel = npbPregameEvidenceSnapshotRel(input.dateKst);
  const abs = path.join(input.cwd, predictionRel);
  const before: NpbPostgameImmutableAudit = {
    predictionRel,
    predictionHashFieldBefore: readHashField(abs),
    predictionHashFieldAfter: null,
    predictionFileSha256Before: sha256File(abs),
    predictionFileSha256After: null,
    predictionMtimeBefore: mtimeMs(abs),
    predictionMtimeAfter: null,
    predictionUnchanged: false,
  };
  return {
    before,
    finish: () => {
      const predictionHashFieldAfter = readHashField(abs);
      const predictionFileSha256After = sha256File(abs);
      const predictionMtimeAfter = mtimeMs(abs);
      return {
        ...before,
        predictionHashFieldAfter,
        predictionFileSha256After,
        predictionMtimeAfter,
        predictionUnchanged:
          before.predictionHashFieldBefore === predictionHashFieldAfter &&
          before.predictionFileSha256Before === predictionFileSha256After &&
          before.predictionMtimeBefore === predictionMtimeAfter,
      };
    },
  };
}

export async function runNpbPostgameOpsV0(
  options: NpbPostgameOpsOptions,
): Promise<NpbPostgameOpsReport> {
  const cwd = options.cwd ?? process.cwd();
  const dateKst = options.dateKst;
  const asOf = options.asOf ?? new Date().toISOString();
  const dryRun = Boolean(options.dryRun);
  const assessOnly = Boolean(options.assessOnly) || Boolean(options.readOnly);
  const writeResults = !dryRun && !assessOnly;

  const stagesRun: NpbPostgameOpsStageName[] = [
    "PREFLIGHT",
    "OFFICIAL_RESULT",
    "PREGAME_JOIN",
    "MARKET_BASELINE",
    "DAILY_EVIDENCE_LIFECYCLE",
    "OPERATOR_SUMMARY",
  ];

  const audit = beginImmutableAudit({ dateKst, cwd });
  const snapshot = await loadNpbPregameEvidenceSnapshot({ dateKst, cwd });

  let failure: NpbPostgameOpsFailure | null = null;
  let resultsWrote = false;
  let results = await loadNpbOfficialResultsV0({ dateKst, cwd });

  if (!snapshot) {
    failure = {
      stage: "PREFLIGHT",
      reason: "NO_PREGAME_EVIDENCE",
      nextAction:
        "Cannot run postgame without Pregame Evidence Snapshot — 사후 Snapshot 금지",
    };
  } else if (writeResults) {
    const collected = collectedOfficialForDate(dateKst);
    if (!collected) {
      if (!results) {
        failure = {
          stage: "OFFICIAL_RESULT",
          reason: "OFFICIAL_RESULT_SOURCE_MISSING",
          nextAction: `No collected official scores for ${dateKst} — add collection or run assess-only`,
        };
      }
    } else {
      const built = await buildNpbOfficialResultsV0({
        dateKst,
        cwd,
        collected,
        collectedAt: asOf,
        write: true,
      });
      results = built.document;
      resultsWrote = built.wrote;
    }
  }

  const day = await assessNpbDailyEvidenceDay({ dateKst, cwd, asOf });
  const view = await loadNpbDailyOpsView({ dateKst, cwd, asOf });
  const immutableAudit = audit.finish();

  if (!immutableAudit.predictionUnchanged && snapshot) {
    failure = {
      stage: "PREFLIGHT",
      reason: "PREGAME_SNAPSHOT_MUTATED",
      nextAction: "ABORT — Pregame Evidence Snapshot must remain immutable",
    };
  }

  if (
    !failure &&
    day.continuity.alert === NPB_PREGAME_EVIDENCE_MISSING &&
    !snapshot
  ) {
    failure = {
      stage: "PREFLIGHT",
      reason: NPB_PREGAME_EVIDENCE_MISSING,
      nextAction: "Freeze evidence before first pitch on next slate",
    };
  }

  let nextAction = "NONE — DAY COMPLETE";
  if (failure) {
    nextAction = failure.nextAction;
  } else if (day.lifecycle === "COMPLETED") {
    nextAction = "NONE — DAY COMPLETE";
  } else if (!results || day.results.finalCount < day.results.total) {
    nextAction = "COLLECT OFFICIAL RESULTS / WAIT FOR FINAL";
  } else {
    nextAction = day.nextAction;
  }

  const opsSuccess =
    failure == null &&
    immutableAudit.predictionUnchanged &&
    day.lifecycle !== "NO_PREGAME_EVIDENCE";

  const report: NpbPostgameOpsReport = {
    schemaVersion: NPB_POSTGAME_OPS_SCHEMA,
    dateKst,
    dryRun,
    assessOnly,
    generatedAt: new Date().toISOString(),
    opsSuccess,
    stagesRun,
    day,
    results,
    resultsWrote,
    recentDays: view.recentDays,
    immutableAudit,
    nextAction,
    failure,
    operatorSummaryText: "",
  };
  report.operatorSummaryText = formatNpbPostgameOpsOperatorSummary(report);
  return report;
}
